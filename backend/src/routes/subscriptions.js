const express = require("express");

const db = require("../config/db");
const requireAuth = require("../middleware/requireAuth");
const { getUsdToTryRate } = require("../services/exchangeRate");
const {
  FREE_LIMIT,
  UUID_REGEX,
  getEffectivePlan,
  getSubscriptionCount,
  lockUserAndGetPlan,
  syncPlanFromRevenueCat,
  withTransaction,
} = require("../services/planService");
const { expireTrials } = require("../services/kivirikService");
const {
  SUBSCRIPTION_WITH_CATALOG_COLUMNS,
  parseBillingFields,
  withPriceTry,
} = require("../services/subscriptionRows");

const router = express.Router();

// Tek istekte eklenebilecek azami kayıt (onboarding/misafir birleştirmesi
// için fazlasıyla yeterli; kötüye kullanımı sınırlar).
const MAX_BULK_ITEMS = 50;

// erişte Premium kaydının katalogdaki yönetici değeri.
const ERISTE_MANAGED_BY = "revenuecat";
const ISO_CURRENCY_REGEX = /^[A-Z]{3}$/;

const RETURNING_COLUMNS =
  "id, catalog_id, started_at, reason, usage_frequency, billing_date, billing_month, price_alert_enabled, cancelled_at";

router.use(requireAuth);

// Önceden iptal edilmiş kaydı yeniden etkinleştirir (aynı katalog kaydı
// tekrar eklenince); gönderilen alanlar yazılır, gönderilmeyenler korunur.
async function reactivateCancelled(client, userId, catalogId, values) {
  const { rows } = await client.query(
    `update user_subscriptions us
     set cancelled_at = null,
         reason = coalesce($3, us.reason),
         usage_frequency = coalesce($4, us.usage_frequency),
         billing_date = coalesce($5, us.billing_date),
         billing_month = case when $5::int is null then us.billing_month else $6::int end,
         price_alert_enabled = coalesce($7, us.price_alert_enabled)
     from subscriptions_catalog sc
     where us.user_id = $1 and us.catalog_id = $2 and us.cancelled_at is not null
       and sc.id = us.catalog_id and sc.managed_by is null and sc.status = 'active'
     returning ${RETURNING_COLUMNS.split(", ").map((column) => `us.${column}`).join(", ")}`,
    [userId, catalogId, ...values]
  );
  return rows[0] ?? null;
}

// POST /api/user/subscriptions — giriş yapmış kullanıcı için yeni abonelik seçimi kaydet.
// Aynı kayıt daha önce "İptal ettim" ile işaretlendiyse yeniden etkinleşir.
router.post("/", async (req, res) => {
  const { catalog_id, reason, usage_frequency, price_alert_enabled } = req.body;

  if (!catalog_id) {
    return res.status(400).json({ error: "catalog_id zorunludur" });
  }

  const billing = parseBillingFields(req.body);

  if (billing.error) {
    return res.status(400).json({ error: billing.error });
  }

  try {
    // Sayım ve ekleme aynı transaction'da, kullanıcı satırı kilitliyken
    // yapılır; eşzamanlı iki istek limiti aşamaz.
    const created = await withTransaction(async (client) => {
      const { plan } = await lockUserAndGetPlan(client, req.user.id);

      if (plan === "free") {
        const count = await getSubscriptionCount(req.user.id, client);
        if (count >= FREE_LIMIT) {
          return { limitReached: true };
        }
      }

      const values = [
        reason || null,
        usage_frequency || null,
        billing.billing_date,
        billing.billing_month,
        price_alert_enabled === undefined ? null : price_alert_enabled,
      ];

      const reactivated = await reactivateCancelled(client, req.user.id, catalog_id, values);
      if (reactivated) {
        return { row: reactivated };
      }

      // Uygulamanın yönettiği (erişte Premium) ve yayında olmayan kayıtlar
      // elle eklenemez.
      const { rows } = await client.query(
        `insert into user_subscriptions
           (user_id, catalog_id, reason, usage_frequency, billing_date, billing_month,
            price_alert_enabled)
         select $1::uuid, sc.id, $3::text, $4::text, $5::int, $6::int, coalesce($7::boolean, true)
         from subscriptions_catalog sc
         where sc.id = $2 and sc.managed_by is null and sc.status = 'active'
         returning ${RETURNING_COLUMNS}`,
        [req.user.id, catalog_id, ...values]
      );

      return { row: rows[0] };
    });

    if (created.limitReached) {
      return res.status(403).json({ code: "LIMIT_REACHED", limit: FREE_LIMIT });
    }

    if (!created.row) {
      return res.status(400).json({ error: "Geçersiz catalog_id" });
    }

    res.status(201).json(created.row);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "Bu abonelik zaten seçili" });
    }

    if (error.code === "23503") {
      return res.status(400).json({ error: "Geçersiz catalog_id" });
    }

    if (error.code === "22P02") {
      return res.status(400).json({ error: "Geçersiz catalog_id formatı" });
    }

    if (error.code === "23514") {
      return res.status(400).json({ error: "Geçersiz usage_frequency veya billing_date değeri" });
    }

    res.status(500).json({ error: error.message });
  }
});

// POST /api/user/subscriptions/bulk — birden çok katalog kaydını tek seferde
// ekler (onboarding seçimleri ve misafir listesinin hesaba aktarılması).
// Gövde: { items: [{ catalog_id, billing_date?, billing_month? }] }. Ücretsiz
// planda toplam FREE_LIMIT'e kadar olanlar gönderim sırasıyla eklenir,
// kalanlar "limit" ile atlanır; kullanıcıda zaten olanlar "duplicate",
// katalogda artık bulunmayanlar "not_found" ile atlanır (silinmiş bir kayıt
// yüzünden misafir listesinin aktarımı sonsuza kadar takılmasın diye 400
// yerine atlanır). Zaten olan kaydın ödeme günü boşsa gönderilen gün ona
// yazılır; misafirde girilen gün hesaba aktarımda kaybolmasın.
router.post("/bulk", async (req, res) => {
  const items = req.body?.items;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "items boş olmayan bir dizi olmalı" });
  }

  if (items.length > MAX_BULK_ITEMS) {
    return res.status(400).json({ error: `En fazla ${MAX_BULK_ITEMS} kayıt gönderilebilir` });
  }

  const rawIds = items.map((item) => item?.catalog_id);

  if (rawIds.some((id) => typeof id !== "string" || !UUID_REGEX.test(id))) {
    return res.status(400).json({ error: "Geçersiz catalog_id formatı" });
  }

  const billingByIndex = items.map(parseBillingFields);
  const billingError = billingByIndex.find((billing) => billing.error);

  if (billingError) {
    return res.status(400).json({ error: billingError.error });
  }

  // Postgres uuid'leri küçük harfle döndürür; Set karşılaştırmaları tutsun.
  const catalogIds = rawIds.map((id) => id.toLowerCase());

  try {
    const { addedIds, skipped } = await withTransaction(async (client) => {
      const { plan } = await lockUserAndGetPlan(client, req.user.id);

      const { rows: ownedRows } = await client.query(
        `select us.catalog_id, sc.managed_by, us.cancelled_at
         from user_subscriptions us
         join subscriptions_catalog sc on sc.id = us.catalog_id
         where us.user_id = $1`,
        [req.user.id]
      );
      const owned = new Set(ownedRows.map((row) => row.catalog_id));

      // Uygulamanın yönettiği (erişte Premium) ve yayında olmayan (taslak,
      // gizli) kayıtlar elle eklenemez; katalogda yokmuş gibi atlanır.
      const { rows: catalogRows } = await client.query(
        `select id from subscriptions_catalog
         where id = any($1::uuid[]) and managed_by is null and status = 'active'`,
        [Array.from(new Set(catalogIds))]
      );
      const existsInCatalog = new Set(catalogRows.map((row) => row.id));

      // Yönetilen ve iptal edilmiş kayıtlar limite sayılmaz. İptal edilmiş
      // bir kayıt burada yeniden etkinleşmez ("duplicate" ile atlanır).
      let count = ownedRows.filter((row) => !row.managed_by && !row.cancelled_at).length;
      const toInsert = [];
      const toFillBilling = [];
      const skippedItems = [];

      catalogIds.forEach((catalogId, index) => {
        const billing = billingByIndex[index];

        if (owned.has(catalogId)) {
          skippedItems.push({ catalog_id: catalogId, reason: "duplicate" });
          if (billing.billing_date !== null) {
            toFillBilling.push({ catalogId, ...billing });
          }
        } else if (!existsInCatalog.has(catalogId)) {
          skippedItems.push({ catalog_id: catalogId, reason: "not_found" });
        } else if (plan === "free" && count >= FREE_LIMIT) {
          skippedItems.push({ catalog_id: catalogId, reason: "limit" });
        } else {
          toInsert.push({ catalogId, ...billing });
          owned.add(catalogId);
          count += 1;
        }
      });

      if (toInsert.length > 0) {
        await client.query(
          `insert into user_subscriptions (user_id, catalog_id, billing_date, billing_month)
           select $1::uuid, * from unnest($2::uuid[], $3::int[], $4::int[])`,
          [
            req.user.id,
            toInsert.map((item) => item.catalogId),
            toInsert.map((item) => item.billing_date),
            toInsert.map((item) => item.billing_month),
          ]
        );
      }

      for (const item of toFillBilling) {
        await client.query(
          `update user_subscriptions
           set billing_date = $3, billing_month = $4
           where user_id = $1 and catalog_id = $2 and billing_date is null`,
          [req.user.id, item.catalogId, item.billing_date, item.billing_month]
        );
      }

      return { addedIds: toInsert.map((item) => item.catalogId), skipped: skippedItems };
    });

    let added = [];

    if (addedIds.length > 0) {
      const { rows } = await db.query(
        `select ${SUBSCRIPTION_WITH_CATALOG_COLUMNS}
         from user_subscriptions us
         join subscriptions_catalog sc on sc.id = us.catalog_id
         where us.user_id = $1 and us.catalog_id = any($2::uuid[])`,
        [req.user.id, addedIds]
      );

      const usdToTryRate = await getUsdToTryRate();
      const order = new Map(addedIds.map((id, index) => [id, index]));

      added = rows
        .map((row) => withPriceTry(row, usdToTryRate))
        .sort((a, b) => order.get(a.catalog_id) - order.get(b.catalog_id));
    }

    res.status(201).json({
      added,
      skipped,
      limit_reached: skipped.some((item) => item.reason === "limit"),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/user/subscriptions — kullanıcının seçtiği abonelikler, katalog bilgisiyle birlikte
router.get("/", async (req, res) => {
  try {
    // Bitiş günü geçmiş denemeler deneme olmaktan çıkar.
    await expireTrials(req.user.id);

    const { rows } = await db.query(
      `select ${SUBSCRIPTION_WITH_CATALOG_COLUMNS}
       from user_subscriptions us
       join subscriptions_catalog sc on sc.id = us.catalog_id
       where us.user_id = $1
       order by sc.app_name, sc.plan_name`,
      [req.user.id]
    );

    const usdToTryRate = await getUsdToTryRate();

    // erişte Premium kaydı, Premium bitince silinmez; managed_active ile
    // istemci "Premium aktif değil" gösterir ve hatırlatma planlamaz.
    const hasManaged = rows.some((row) => row.managed_by);
    const premiumActive = hasManaged && (await getEffectivePlan(req.user.id)).plan === "premium";

    const subscriptions = rows.map((row) => ({
      ...withPriceTry(row, usdToTryRate),
      ...(row.managed_by ? { managed_active: premiumActive } : {}),
    }));

    res.json({ subscriptions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/user/subscriptions/eriste-premium — erişte Premium'u kullanıcının
// takip listesine ekler ya da günceller (satın alma sonrası ve her açılışta,
// istemci RevenueCat customerInfo'ya bakarak çağırır).
// Gövde: { billing_cycle: "monthly" | "yearly", price, currency,
//          billing_date, billing_month? } — fiyat App Store'un kullanıcıya
// gösterdiği fiyattır, ödeme günü yenileme tarihinden türetilir.
// Yanıt: { status: "added" | "updated" | "dismissed" | "inactive" }
//   dismissed: kullanıcı erişte'yi listesinden silmiş, tekrar eklenmez.
//   inactive: sunucuya göre Premium aktif değil (webhook/sync gecikmesi);
//             istemci sonraki açılışta tekrar dener.
router.post("/eriste-premium", async (req, res) => {
  const { billing_cycle, currency } = req.body;
  const price = Number(req.body.price);
  const billing = parseBillingFields(req.body);

  if (billing_cycle !== "monthly" && billing_cycle !== "yearly") {
    return res.status(400).json({ error: "billing_cycle monthly ya da yearly olmalı" });
  }

  if (!Number.isFinite(price) || price < 0) {
    return res.status(400).json({ error: "Geçersiz price" });
  }

  if (typeof currency !== "string" || !ISO_CURRENCY_REGEX.test(currency)) {
    return res.status(400).json({ error: "Geçersiz currency" });
  }

  if (billing.error) {
    return res.status(400).json({ error: billing.error });
  }

  // Aylık planda ay tutulmaz; yıllıkta ay da gerekir.
  const billingMonth = billing_cycle === "yearly" ? billing.billing_month : null;
  const billingDate = billing_cycle === "yearly" && !billingMonth ? null : billing.billing_date;

  try {
    // Kayıtlı plan Premium değilse (webhook gelmemiş ya da kayıtlı bitiş
    // tarihi yenilemeden önce geçmiş) RevenueCat'e bir kez sorulur.
    if ((await getEffectivePlan(req.user.id)).plan !== "premium") {
      await syncPlanFromRevenueCat(req.user.id).catch(() => {});
    }

    const status = await withTransaction(async (client) => {
      const { plan } = await lockUserAndGetPlan(client, req.user.id);

      if (plan !== "premium") {
        return "inactive";
      }

      const { rows: userRows } = await client.query(
        "select eriste_dismissed from users where id = $1",
        [req.user.id]
      );

      if (userRows[0]?.eriste_dismissed) {
        return "dismissed";
      }

      const { rows: catalogRows } = await client.query(
        "select id from subscriptions_catalog where managed_by = $1 and billing_cycle = $2 limit 1",
        [ERISTE_MANAGED_BY, billing_cycle]
      );

      if (catalogRows.length === 0) {
        throw new Error("erişte katalog kaydı bulunamadı (migration 0011)");
      }

      const catalogId = catalogRows[0].id;

      // Plan değişimi (aylık ↔ yıllık) aynı satırı başka katalog kaydına
      // taşır; yenilemede kayan ödeme günü de burada düzelir.
      const { rowCount } = await client.query(
        `update user_subscriptions us
         set catalog_id = $2, custom_price = $3, custom_currency = $4,
             billing_date = $5, billing_month = $6
         from subscriptions_catalog sc
         where us.user_id = $1 and sc.id = us.catalog_id and sc.managed_by = $7`,
        [req.user.id, catalogId, price, currency, billingDate, billingMonth, ERISTE_MANAGED_BY]
      );

      if (rowCount > 0) {
        return "updated";
      }

      await client.query(
        `insert into user_subscriptions
           (user_id, catalog_id, custom_price, custom_currency, billing_date, billing_month)
         values ($1, $2, $3, $4, $5, $6)`,
        [req.user.id, catalogId, price, currency, billingDate, billingMonth]
      );

      return "added";
    });

    res.json({ status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/user/subscriptions/:id — reason, price_alert_enabled ve ödeme
// günü alanlarını günceller (gönderilmeyen alanlar korunur). billing_date
// gönderilirse billing_month da onunla birlikte yazılır (aylık planda
// gönderilmez, null olur); billing_date: null ödeme gününü temizler.
router.patch("/:id", async (req, res) => {
  const { reason, price_alert_enabled } = req.body;
  const hasBilling = req.body.billing_date !== undefined;
  const billing = parseBillingFields(req.body);

  if (billing.error) {
    return res.status(400).json({ error: billing.error });
  }

  const params = [
    reason === undefined ? null : reason,
    price_alert_enabled === undefined ? null : price_alert_enabled,
    hasBilling,
    billing.billing_date,
    billing.billing_month,
  ];

  try {
    const { rows } = await db.query(
      `update user_subscriptions
       set reason = coalesce($1, reason),
           price_alert_enabled = coalesce($2, price_alert_enabled),
           billing_date = case when $3::boolean then $4::int else billing_date end,
           billing_month = case when $3::boolean then $5::int else billing_month end
       where id = $6 and user_id = $7
       returning ${RETURNING_COLUMNS}`,
      [...params, req.params.id, req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Kayıt bulunamadı" });
    }

    res.json(rows[0]);
  } catch (error) {
    if (error.code === "22P02") {
      return res.status(400).json({ error: "Geçersiz id formatı" });
    }

    if (error.code === "23514") {
      return res.status(400).json({ error: "Geçersiz billing_date değeri" });
    }

    res.status(500).json({ error: error.message });
  }
});

// POST /api/user/subscriptions/:id/cancel — "İptal ettim": cancelled_at
// yazılır. Kayıt silinmez; toplamlardan, hatırlatmalardan ve ücretsiz plan
// sınırından düşer, Kıvırık iptal sonrası ilk ödeme gününde çekim olup
// olmadığını sorar (cancel_verify). erişte Premium App Store'dan iptal
// edilir, burada işaretlenemez. Zaten iptal edilmişse tarih değişmez.
router.post("/:id/cancel", async (req, res) => {
  try {
    const { rows } = await db.query(
      `update user_subscriptions us
       set cancelled_at = coalesce(us.cancelled_at, now())
       from subscriptions_catalog sc
       where us.id = $1 and us.user_id = $2 and sc.id = us.catalog_id and sc.managed_by is null
       returning us.id, us.cancelled_at`,
      [req.params.id, req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Kayıt bulunamadı" });
    }

    res.json(rows[0]);
  } catch (error) {
    if (error.code === "22P02") {
      return res.status(400).json({ error: "Geçersiz id formatı" });
    }

    res.status(500).json({ error: error.message });
  }
});

// POST /api/user/subscriptions/:id/restore — "Geri al": iptal işareti
// kalkar. Ücretsiz planda sınır doluysa 403 LIMIT_REACHED.
router.post("/:id/restore", async (req, res) => {
  try {
    const result = await withTransaction(async (client) => {
      const { plan } = await lockUserAndGetPlan(client, req.user.id);

      const { rows: current } = await client.query(
        "select cancelled_at from user_subscriptions where id = $1 and user_id = $2",
        [req.params.id, req.user.id]
      );

      if (current.length === 0) {
        return { notFound: true };
      }

      if (!current[0].cancelled_at) {
        return { row: { id: req.params.id, cancelled_at: null } };
      }

      if (plan === "free" && (await getSubscriptionCount(req.user.id, client)) >= FREE_LIMIT) {
        return { limitReached: true };
      }

      const { rows } = await client.query(
        `update user_subscriptions set cancelled_at = null
         where id = $1 and user_id = $2
         returning id, cancelled_at`,
        [req.params.id, req.user.id]
      );

      return { row: rows[0] };
    });

    if (result.notFound) {
      return res.status(404).json({ error: "Kayıt bulunamadı" });
    }

    if (result.limitReached) {
      return res.status(403).json({ code: "LIMIT_REACHED", limit: FREE_LIMIT });
    }

    res.json(result.row);
  } catch (error) {
    if (error.code === "22P02") {
      return res.status(400).json({ error: "Geçersiz id formatı" });
    }

    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/user/subscriptions/:id — kullanıcının bir aboneliğini kaldır.
// erişte Premium kaydı silinirse bu tercih saklanır ve kayıt tekrar eklenmez.
router.delete("/:id", async (req, res) => {
  try {
    const rows = await withTransaction(async (client) => {
      const { rows: deleted } = await client.query(
        `delete from user_subscriptions us
         using subscriptions_catalog sc
         where us.id = $1 and us.user_id = $2 and sc.id = us.catalog_id
         returning us.id, sc.managed_by`,
        [req.params.id, req.user.id]
      );

      if (deleted[0]?.managed_by === ERISTE_MANAGED_BY) {
        await client.query("update users set eriste_dismissed = true where id = $1", [
          req.user.id,
        ]);
      }

      return deleted;
    });

    if (rows.length === 0) {
      return res.status(404).json({ error: "Kayıt bulunamadı" });
    }

    res.status(204).send();
  } catch (error) {
    if (error.code === "22P02") {
      return res.status(400).json({ error: "Geçersiz id formatı" });
    }

    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

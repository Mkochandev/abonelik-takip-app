const express = require("express");

const db = require("../config/db");
const requireAuth = require("../middleware/requireAuth");
const { getUsdToTryRate } = require("../services/exchangeRate");
const {
  FREE_LIMIT,
  UUID_REGEX,
  getSubscriptionCount,
  lockUserAndGetPlan,
  withTransaction,
} = require("../services/planService");

const router = express.Router();

// Tek istekte eklenebilecek azami kayıt (onboarding/misafir birleştirmesi
// için fazlasıyla yeterli; kötüye kullanımı sınırlar).
const MAX_BULK_ITEMS = 50;

const SUBSCRIPTION_WITH_CATALOG_COLUMNS = `us.id, us.started_at, us.reason, us.usage_frequency,
  us.price_alert_enabled, us.billing_date, us.billing_month, sc.id as catalog_id, sc.app_name,
  sc.plan_name, sc.current_price, sc.currency, sc.billing_cycle, sc.category, sc.domain,
  sc.logo_url`;

const RETURNING_COLUMNS =
  "id, catalog_id, started_at, reason, usage_frequency, billing_date, billing_month, price_alert_enabled";

function isIntInRange(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

// Ödeme günü (1–31) ve yıllık planlar için ayı (1–12) doğrular. Boş değerler
// null olur; ay, gün olmadan kabul edilmez.
function parseBillingFields(source) {
  const day = source?.billing_date ?? null;
  const month = source?.billing_month ?? null;

  if (day !== null && !isIntInRange(day, 1, 31)) {
    return { error: "billing_date 1 ile 31 arasında bir tam sayı olmalı" };
  }

  if (month !== null && (!isIntInRange(month, 1, 12) || day === null)) {
    return { error: "billing_month 1 ile 12 arasında olmalı ve billing_date ile gönderilmeli" };
  }

  return { billing_date: day, billing_month: month };
}

function withPriceTry(row, usdToTryRate) {
  return {
    ...row,
    current_price_try:
      row.currency === "USD"
        ? Number((Number(row.current_price) * usdToTryRate).toFixed(2))
        : Number(row.current_price),
  };
}

router.use(requireAuth);

// POST /api/user/subscriptions — giriş yapmış kullanıcı için yeni abonelik seçimi kaydet
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
          return null;
        }
      }

      const { rows } = await client.query(
        `insert into user_subscriptions
           (user_id, catalog_id, reason, usage_frequency, billing_date, billing_month,
            price_alert_enabled)
         values ($1, $2, $3, $4, $5, $6, coalesce($7, true))
         returning ${RETURNING_COLUMNS}`,
        [
          req.user.id,
          catalog_id,
          reason || null,
          usage_frequency || null,
          billing.billing_date,
          billing.billing_month,
          price_alert_enabled === undefined ? null : price_alert_enabled,
        ]
      );

      return rows[0];
    });

    if (!created) {
      return res.status(403).json({ code: "LIMIT_REACHED", limit: FREE_LIMIT });
    }

    res.status(201).json(created);
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
        "select catalog_id from user_subscriptions where user_id = $1",
        [req.user.id]
      );
      const owned = new Set(ownedRows.map((row) => row.catalog_id));

      const { rows: catalogRows } = await client.query(
        "select id from subscriptions_catalog where id = any($1::uuid[])",
        [Array.from(new Set(catalogIds))]
      );
      const existsInCatalog = new Set(catalogRows.map((row) => row.id));

      let count = owned.size;
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
    const { rows } = await db.query(
      `select ${SUBSCRIPTION_WITH_CATALOG_COLUMNS}
       from user_subscriptions us
       join subscriptions_catalog sc on sc.id = us.catalog_id
       where us.user_id = $1
       order by sc.app_name, sc.plan_name`,
      [req.user.id]
    );

    const usdToTryRate = await getUsdToTryRate();

    const subscriptions = rows.map((row) => withPriceTry(row, usdToTryRate));

    res.json({ subscriptions });
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

// DELETE /api/user/subscriptions/:id — kullanıcının bir aboneliğini kaldır
router.delete("/:id", async (req, res) => {
  try {
    const { rows } = await db.query(
      "delete from user_subscriptions where id = $1 and user_id = $2 returning id",
      [req.params.id, req.user.id]
    );

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

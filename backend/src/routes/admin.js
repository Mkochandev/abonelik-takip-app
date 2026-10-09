const express = require("express");

const db = require("../config/db");
const requireAdminSecret = require("../middleware/requireAdminSecret");
const { scanAllPrices } = require("../services/priceScanner");

const router = express.Router();

router.use(requireAdminSecret);

// Son fiyat taramasının durumu. Yalnızca bellekte tutulur; sunucu yeniden
// başlarsa sıfırlanır.
let scanState = {
  status: "idle", // idle | running | completed | failed
  started_at: null,
  finished_at: null,
  progress: null,
  summary: null,
  error: null,
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DOMAIN_REGEX =/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

// "https://www.Netflix.com/tr/" -> "netflix.com". Boş değer null olur;
// geçersiz değerde { error } döner.
function parseDomain(value) {
  if (value === undefined || value === null) {
    return { value: null };
  }

  if (typeof value !== "string") {
    return { error: "Geçersiz alan adı" };
  }

  const domain = value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[/?#].*$/, "");

  if (!domain) {
    return { value: null };
  }

  if (!DOMAIN_REGEX.test(domain)) {
    return { error: "Geçersiz alan adı (örn. netflix.com)" };
  }

  return { value: domain };
}

// Boş değer null olur; dolu değer https:// ile başlamalıdır.
function parseLogoUrl(value) {
  if (value === undefined || value === null) {
    return { value: null };
  }

  if (typeof value !== "string") {
    return { error: "Geçersiz logo URL" };
  }

  const logoUrl = value.trim();

  if (!logoUrl) {
    return { value: null };
  }

  if (!logoUrl.startsWith("https://")) {
    return { error: "Logo URL https:// ile başlamalı" };
  }

  return { value: logoUrl };
}

// POST /api/admin/catalog/scan-prices — tüm kataloğu tarayıp fiyatları
// Anthropic API'si ile güncel siteden çıkarmaya çalışır. Tarama dakikalar
// sürebildiği için arka planda başlatılır ve hemen 202 dönülür; sonuç
// GET /scan-status ile sorgulanır.
router.post("/scan-prices", (req, res) => {
  if (scanState.status === "running") {
    return res.status(202).json({ ...scanState, already_running: true });
  }

  scanState = {
    status: "running",
    started_at: new Date().toISOString(),
    finished_at: null,
    progress: { done: 0, total: null },
    summary: null,
    error: null,
  };

  scanAllPrices({
    onProgress: (done, total) => {
      scanState.progress = { done, total };
    },
  })
    .then((summary) => {
      scanState = {
        ...scanState,
        status: "completed",
        finished_at: new Date().toISOString(),
        summary,
      };
    })
    .catch((error) => {
      console.error("scan-prices: tarama sırasında hata:", error.message);
      scanState = {
        ...scanState,
        status: "failed",
        finished_at: new Date().toISOString(),
        error: error.message,
      };
    });

  res.status(202).json(scanState);
});

// GET /api/admin/catalog/scan-status — son/devam eden taramanın durumu
router.get("/scan-status", (req, res) => {
  res.json(scanState);
});

// GET /api/admin/catalog — tüm katalog, düz liste (admin panel için)
router.get("/", async (req, res) => {
  try {
    const { rows } = await db.query(
      "select * from subscriptions_catalog order by app_name, plan_name"
    );

    res.json({ catalog: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function parseIds(body) {
  const ids = body?.ids;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500) {
    return { error: "ids 1-500 elemanlı bir dizi olmalı" };
  }
  if (ids.some((id) => typeof id !== "string" || !UUID_REGEX.test(id))) {
    return { error: "Geçersiz id formatı" };
  }
  return { value: ids };
}

// POST /api/admin/catalog/approve — { ids } taslak/gizli kayıtları yayına
// alır ve fiyatı doğrulanmış sayar. Fiyatı olmayanlar yayına alınamaz;
// yanıtta skipped olarak döner.
router.post("/approve", async (req, res) => {
  const ids = parseIds(req.body);
  if (ids.error) {
    return res.status(400).json({ error: ids.error });
  }

  try {
    const { rows } = await db.query(
      `update subscriptions_catalog
       set status = 'active', price_status = 'verified'
       where id = any($1::uuid[]) and current_price is not null and current_price >= 0
         and managed_by is null
       returning id`,
      [ids.value]
    );
    const approved = new Set(rows.map((row) => row.id));
    res.json({
      approved: Array.from(approved),
      skipped: ids.value.filter((id) => !approved.has(id.toLowerCase())),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/admin/catalog/hide — { ids } kayıtları gizler (mobilde görünmez,
// silinmez; ekleyen kullanıcıların kaydı durur).
router.post("/hide", async (req, res) => {
  const ids = parseIds(req.body);
  if (ids.error) {
    return res.status(400).json({ error: ids.error });
  }

  try {
    const { rows } = await db.query(
      `update subscriptions_catalog set status = 'hidden'
       where id = any($1::uuid[]) and managed_by is null
       returning id`,
      [ids.value]
    );
    res.json({ hidden: rows.map((row) => row.id) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/admin/catalog — yeni app/plan ekle
router.post("/", async (req, res) => {
  const {
    app_name,
    plan_name,
    current_price,
    currency,
    billing_cycle,
    source_url,
    category,
    cancel_url,
  } = req.body;

  if (!app_name || current_price === undefined || current_price === null) {
    return res.status(400).json({ error: "app_name ve current_price zorunludur" });
  }

  const domain = parseDomain(req.body.domain);
  const logoUrl = parseLogoUrl(req.body.logo_url);

  if (domain.error || logoUrl.error) {
    return res.status(400).json({ error: domain.error || logoUrl.error });
  }

  try {
    const { rows } = await db.query(
      `insert into subscriptions_catalog
         (app_name, plan_name, current_price, currency, source_url, category, cancel_url,
          domain, logo_url, billing_cycle)
       values ($1, $2, $3, coalesce($4, 'TRY'), $5, $6, $7, $8, $9, coalesce($10, 'monthly'))
       returning *`,
      [
        app_name,
        plan_name || null,
        current_price,
        currency || null,
        source_url || null,
        category || null,
        cancel_url || null,
        domain.value,
        logoUrl.value,
        billing_cycle || null,
      ]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === "23514") {
      return res.status(400).json({ error: "Geçersiz category veya billing_cycle değeri" });
    }

    res.status(500).json({ error: error.message });
  }
});

// PUT /api/admin/catalog/:id — mevcut bir kaydı güncelle (gönderilmeyen alanlar korunur)
// domain ve logo_url gönderildiğinde boş değer alanı temizler (null yapar).
router.put("/:id", async (req, res) => {
  const {
    app_name,
    plan_name,
    current_price,
    currency,
    source_url,
    last_checked_at,
    category,
    cancel_url,
    billing_cycle,
    source_note,
  } = req.body;

  const params = [
    app_name,
    plan_name,
    current_price,
    currency,
    source_url,
    last_checked_at,
    category,
    cancel_url,
    billing_cycle,
    source_note,
  ].map((value) => (value === undefined ? null : value));

  const hasDomain = req.body.domain !== undefined;
  const hasLogoUrl = req.body.logo_url !== undefined;
  const domain = parseDomain(req.body.domain);
  const logoUrl = parseLogoUrl(req.body.logo_url);

  if (domain.error || logoUrl.error) {
    return res.status(400).json({ error: domain.error || logoUrl.error });
  }

  try {
    // Admin'in elle girdiği fiyat doğrulanmış sayılır. Yayındaki bir kaydın
    // fiyatı değişirse price_history'ye (eski fiyat, yeni fiyat, kaynak =
    // admin) kayıt düşer; Kıvırık'ın zam kartı buna bakar. "old" CTE'si
    // güncellemeden önceki satırı okur (aynı ifadedeki CTE'ler aynı anlık
    // görüntüyü görür).
    const { rows } = await db.query(
      `with old as (
         select id, current_price from subscriptions_catalog where id = $15 for update
       ),
       upd as (
       update subscriptions_catalog
       set app_name = coalesce($1, app_name),
           plan_name = coalesce($2, plan_name),
           current_price = coalesce($3::numeric, current_price),
           price_status = case when $3::numeric is not null then 'verified' else price_status end,
           currency = coalesce($4, currency),
           source_url = coalesce($5, source_url),
           last_checked_at = coalesce($6, last_checked_at),
           category = coalesce($7, category),
           cancel_url = coalesce($8, cancel_url),
           billing_cycle = coalesce($9, billing_cycle),
           source_note = coalesce($10, source_note),
           domain = case when $11::boolean then $12 else domain end,
           logo_url = case when $13::boolean then $14 else logo_url end
       where id = $15
       returning *
       ),
       history as (
         insert into price_history (catalog_id, price, new_price, source)
         select upd.id, old.current_price, upd.current_price, 'admin'
         from upd join old on old.id = upd.id
         where upd.status = 'active' and old.current_price is not null
           and old.current_price is distinct from upd.current_price
       )
       select * from upd`,
      [...params, hasDomain, domain.value, hasLogoUrl, logoUrl.value, req.params.id]
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
      return res.status(400).json({ error: "Geçersiz category veya billing_cycle değeri" });
    }

    res.status(500).json({ error: error.message });
  }
});

// GET /api/admin/catalog/price-reports — kullanıcıların "farklı ödüyorum"
// dediği kayıtlar (Şüpheli fiyatlar): katalog satırı, bildirilen tutarlar,
// adet ve son bildirim tarihi; en çok bildirilen önce.
router.get("/price-reports", async (req, res) => {
  try {
    const { rows } = await db.query(
      `select sc.id as catalog_id, sc.app_name, sc.plan_name, sc.current_price, sc.currency,
              sc.billing_cycle, sc.source_url, sc.domain, sc.logo_url, sc.category,
              count(pr.id)::int as report_count,
              array_agg(pr.reported_price order by pr.created_at desc) as reported_prices,
              max(pr.created_at) as last_reported_at
       from price_reports pr
       join subscriptions_catalog sc on sc.id = pr.catalog_id
       group by sc.id
       order by report_count desc, last_reported_at desc`
    );
    res.json({ reports: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/admin/catalog/:id — bir kaydı sil
router.delete("/:id", async (req, res) => {
  try {
    const { rows } = await db.query(
      "delete from subscriptions_catalog where id = $1 returning id",
      [req.params.id]
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

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

// POST /api/admin/catalog — yeni app/plan ekle
router.post("/", async (req, res) => {
  const { app_name, plan_name, current_price, currency, source_url, category, cancel_url } = req.body;

  if (!app_name || current_price === undefined || current_price === null) {
    return res.status(400).json({ error: "app_name ve current_price zorunludur" });
  }

  try {
    const { rows } = await db.query(
      `insert into subscriptions_catalog
         (app_name, plan_name, current_price, currency, source_url, category, cancel_url)
       values ($1, $2, $3, coalesce($4, 'TRY'), $5, $6, $7)
       returning *`,
      [
        app_name,
        plan_name || null,
        current_price,
        currency || null,
        source_url || null,
        category || null,
        cancel_url || null,
      ]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === "23514") {
      return res.status(400).json({ error: "Geçersiz category değeri" });
    }

    res.status(500).json({ error: error.message });
  }
});

// PUT /api/admin/catalog/:id — mevcut bir kaydı güncelle (gönderilmeyen alanlar korunur)
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
  ].map((value) => (value === undefined ? null : value));

  try {
    const { rows } = await db.query(
      `update subscriptions_catalog
       set app_name = coalesce($1, app_name),
           plan_name = coalesce($2, plan_name),
           current_price = coalesce($3, current_price),
           currency = coalesce($4, currency),
           source_url = coalesce($5, source_url),
           last_checked_at = coalesce($6, last_checked_at),
           category = coalesce($7, category),
           cancel_url = coalesce($8, cancel_url)
       where id = $9
       returning *`,
      [...params, req.params.id]
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
      return res.status(400).json({ error: "Geçersiz category değeri" });
    }

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

const express = require("express");

const db = require("../config/db");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

router.use(requireAuth);

// POST /api/user/subscriptions — giriş yapmış kullanıcı için yeni abonelik seçimi kaydet
router.post("/", async (req, res) => {
  const { catalog_id, reason, usage_frequency, billing_date, price_alert_enabled } = req.body;

  if (!catalog_id) {
    return res.status(400).json({ error: "catalog_id zorunludur" });
  }

  try {
    const { rows } = await db.query(
      `insert into user_subscriptions
         (user_id, catalog_id, reason, usage_frequency, billing_date, price_alert_enabled)
       values ($1, $2, $3, $4, $5, coalesce($6, true))
       returning id, catalog_id, started_at, reason, usage_frequency, billing_date, price_alert_enabled`,
      [
        req.user.id,
        catalog_id,
        reason || null,
        usage_frequency || null,
        billing_date || null,
        price_alert_enabled === undefined ? null : price_alert_enabled,
      ]
    );

    res.status(201).json(rows[0]);
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

// GET /api/user/subscriptions — kullanıcının seçtiği abonelikler, katalog bilgisiyle birlikte
router.get("/", async (req, res) => {
  try {
    const { rows } = await db.query(
      `select us.id, us.started_at, us.reason, us.usage_frequency, us.price_alert_enabled,
              us.billing_date, sc.id as catalog_id, sc.app_name, sc.plan_name,
              sc.current_price, sc.currency, sc.category
       from user_subscriptions us
       join subscriptions_catalog sc on sc.id = us.catalog_id
       where us.user_id = $1
       order by sc.app_name, sc.plan_name`,
      [req.user.id]
    );

    res.json({ subscriptions: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/user/subscriptions/:id — reason, price_alert_enabled ve
// billing_date alanlarını günceller (gönderilmeyen alanlar korunur)
router.patch("/:id", async (req, res) => {
  const { reason, price_alert_enabled, billing_date } = req.body;

  const params = [
    reason === undefined ? null : reason,
    price_alert_enabled === undefined ? null : price_alert_enabled,
    billing_date === undefined ? null : billing_date,
  ];

  try {
    const { rows } = await db.query(
      `update user_subscriptions
       set reason = coalesce($1, reason),
           price_alert_enabled = coalesce($2, price_alert_enabled),
           billing_date = coalesce($3, billing_date)
       where id = $4 and user_id = $5
       returning id, catalog_id, started_at, reason, usage_frequency, billing_date, price_alert_enabled`,
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

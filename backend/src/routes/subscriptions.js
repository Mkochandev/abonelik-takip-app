const express = require("express");

const db = require("../config/db");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

router.use(requireAuth);

// POST /api/user/subscriptions — giriş yapmış kullanıcı için yeni abonelik seçimi kaydet
router.post("/", async (req, res) => {
  const { catalog_id } = req.body;

  if (!catalog_id) {
    return res.status(400).json({ error: "catalog_id zorunludur" });
  }

  try {
    const { rows } = await db.query(
      "insert into user_subscriptions (user_id, catalog_id) values ($1, $2) returning id, catalog_id, started_at",
      [req.user.id, catalog_id]
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

    res.status(500).json({ error: error.message });
  }
});

// GET /api/user/subscriptions — kullanıcının seçtiği abonelikler, katalog bilgisiyle birlikte
router.get("/", async (req, res) => {
  try {
    const { rows } = await db.query(
      `select us.id, us.started_at, sc.id as catalog_id, sc.app_name, sc.plan_name,
              sc.current_price, sc.currency
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

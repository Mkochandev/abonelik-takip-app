const express = require("express");

const db = require("../config/db");

const router = express.Router();

function groupByAppName(rows) {
  const grouped = new Map();

  for (const row of rows) {
    if (!grouped.has(row.app_name)) {
      grouped.set(row.app_name, { app_name: row.app_name, plans: [] });
    }

    grouped.get(row.app_name).plans.push({
      id: row.id,
      plan_name: row.plan_name,
      current_price: row.current_price,
      currency: row.currency,
      category: row.category,
      source_url: row.source_url,
      last_checked_at: row.last_checked_at,
    });
  }

  return Array.from(grouped.values());
}

// GET /api/catalog — tüm katalog, app_name'e göre gruplanmış
// ?category=... verilirse yalnızca o kategorideki kayıtlar döner.
router.get("/", async (req, res) => {
  const { category } = req.query;

  try {
    const { rows } = category
      ? await db.query(
          "select * from subscriptions_catalog where category = $1 order by app_name, plan_name",
          [category]
        )
      : await db.query(
          "select * from subscriptions_catalog order by app_name, plan_name"
        );

    res.json({ catalog: groupByAppName(rows) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/catalog/search?q=... — app_name içinde arama
// /:id ile çakışmaması için /:id route'undan ÖNCE tanımlanmalı.
router.get("/search", async (req, res) => {
  const q = (req.query.q || "").trim();
  const { category } = req.query;

  if (!q) {
    return res.status(400).json({ error: "q parametresi zorunludur" });
  }

  try {
    const params = [`%${q}%`];
    let sql = "select * from subscriptions_catalog where app_name ilike $1";

    if (category) {
      params.push(category);
      sql += ` and category = $${params.length}`;
    }

    sql += " order by app_name, plan_name";

    const { rows } = await db.query(sql, params);

    res.json({ catalog: groupByAppName(rows) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/catalog/:id — tek kayıt + fiyat geçmişi
router.get("/:id", async (req, res) => {
  try {
    const { rows } = await db.query(
      "select * from subscriptions_catalog where id = $1",
      [req.params.id]
    );

    const catalogItem = rows[0];

    if (!catalogItem) {
      return res.status(404).json({ error: "Kayıt bulunamadı" });
    }

    const { rows: priceHistory } = await db.query(
      "select id, price, changed_at from price_history where catalog_id = $1 order by changed_at desc",
      [req.params.id]
    );

    res.json({ ...catalogItem, price_history: priceHistory });
  } catch (error) {
    if (error.code === "22P02") {
      return res.status(400).json({ error: "Geçersiz id formatı" });
    }

    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

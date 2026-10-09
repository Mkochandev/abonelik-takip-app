const express = require("express");

const requireAuth = require("../middleware/requireAuth");
const { getSettings, updateSettings } = require("../services/kivirikService");

const router = express.Router();

router.use(requireAuth);

// GET /api/user/settings — { reminder_days_before, is_student, monthly_budget }
// (sorulmamış alanlar null; hatırlatma uygulamada 1 gün varsayılır).
router.get("/", async (req, res) => {
  try {
    res.json(await getSettings(req.user.id));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/user/settings — gönderilen alanları günceller (ayarlar ekranı).
router.put("/", async (req, res) => {
  const values = {};
  const { reminder_days_before, is_student, monthly_budget } = req.body ?? {};

  if (reminder_days_before !== undefined) {
    if (![0, 1, 3, 7].includes(reminder_days_before)) {
      return res.status(400).json({ error: "reminder_days_before 0, 1, 3 ya da 7 olmalı" });
    }
    values.reminder_days_before = reminder_days_before;
  }

  if (is_student !== undefined) {
    if (is_student !== null && typeof is_student !== "boolean") {
      return res.status(400).json({ error: "is_student boolean olmalı" });
    }
    values.is_student = is_student;
  }

  if (monthly_budget !== undefined) {
    if (monthly_budget !== null && !(Number.isFinite(monthly_budget) && monthly_budget >= 0)) {
      return res.status(400).json({ error: "monthly_budget 0 ya da pozitif olmalı" });
    }
    values.monthly_budget = monthly_budget;
  }

  try {
    res.json(await updateSettings(req.user.id, values));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

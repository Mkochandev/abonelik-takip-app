const express = require("express");

const requireAuth = require("../middleware/requireAuth");
const { withTransaction } = require("../services/planService");
const {
  KivirikError,
  answerQuestion,
  dismissQuestion,
  getPendingQuestions,
} = require("../services/kivirikService");

const router = express.Router();

router.use(requireAuth);

function handleError(res, error) {
  if (error instanceof KivirikError) {
    return res.status(error.status).json({ error: error.message });
  }
  if (error.code === "22P02") {
    return res.status(400).json({ error: "Geçersiz id formatı" });
  }
  if (error.code === "23514") {
    return res.status(400).json({ error: "Geçersiz değer" });
  }
  return res.status(500).json({ error: error.message });
}

// GET /api/kivirik/questions — bekleyen soruları anlık hesaplar.
// Yanıt: { total, trigger, questions: [{ key, user_subscription_id, period, event, params }] }
// (en fazla 3 soru, öncelik sırasıyla; trigger: en öndeki soru tetiklemeliyse o).
router.get("/questions", async (req, res) => {
  try {
    res.json(await getPendingQuestions(req.user.id));
  } catch (error) {
    handleError(res, error);
  }
});

// POST /api/kivirik/answers — { key, user_subscription_id, period, answer, value }
// İlgili alanı/ayarı günceller ve cevabı kaydeder (tek transaction).
// Yanıt: güncel bekleyen soru sayısı ve tetiklemeli soru.
router.post("/answers", async (req, res) => {
  try {
    await answerQuestion(req.user.id, req.body, withTransaction);
    const { total, trigger } = await getPendingQuestions(req.user.id);
    res.json({ ok: true, total, trigger });
  } catch (error) {
    handleError(res, error);
  }
});

// POST /api/kivirik/dismiss — { key, user_subscription_id, mode: "later" | "never" }
router.post("/dismiss", async (req, res) => {
  try {
    await dismissQuestion(req.user.id, req.body);
    const { total, trigger } = await getPendingQuestions(req.user.id);
    res.json({ ok: true, total, trigger });
  } catch (error) {
    handleError(res, error);
  }
});

module.exports = router;

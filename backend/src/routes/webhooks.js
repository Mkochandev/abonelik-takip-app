const crypto = require("crypto");

const express = require("express");

const db = require("../config/db");

const router = express.Router();

// RevenueCat, dashboard'da ayarlanan Authorization header değerini olduğu
// gibi gönderir (Bearer önekli değil, düz bir paylaşılan sır). Zamanlama
// saldırılarına karşı sabit zamanlı karşılaştırma kullanıyoruz.
function isValidWebhookSecret(providedSecret) {
  const expectedSecret = process.env.REVENUECAT_WEBHOOK_SECRET;

  if (!expectedSecret || !providedSecret) {
    return false;
  }

  const providedBuffer = Buffer.from(providedSecret);
  const expectedBuffer = Buffer.from(expectedSecret);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

const PREMIUM_EVENT_TYPES = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "PRODUCT_CHANGE",
]);

// POST /api/webhooks/revenuecat — RevenueCat'ten gelen abonelik olayları.
// app_user_id, mobil tarafta Purchases.logIn ile ayarlanan Supabase
// kullanıcı id'sidir.
router.post("/revenuecat", async (req, res) => {
  if (!isValidWebhookSecret(req.headers.authorization)) {
    return res.status(401).json({ error: "Geçersiz webhook secret" });
  }

  const event = req.body?.event;

  if (!event || !event.app_user_id || !event.type) {
    return res.status(400).json({ error: "Geçersiz webhook gövdesi" });
  }

  const { type, app_user_id, expiration_at_ms } = event;

  try {
    if (PREMIUM_EVENT_TYPES.has(type)) {
      await db.query("update users set plan = 'premium', premium_expires_at = $2 where id = $1", [
        app_user_id,
        expiration_at_ms ? new Date(Number(expiration_at_ms)) : null,
      ]);
    } else if (type === "EXPIRATION") {
      await db.query("update users set plan = 'free' where id = $1", [app_user_id]);
    }
    // CANCELLATION: kullanıcı dönem sonuna kadar premium kalmaya devam eder
    // (premium_expires_at değişmez); başka bir işlem gerekmiyor.

    res.status(200).json({ received: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

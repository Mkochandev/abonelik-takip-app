const crypto = require("crypto");

const express = require("express");

const { isValidUserId, syncPlanFromRevenueCat } = require("../services/planService");

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

// TRANSFER olaylarında hem eski hem yeni sahibin planı değişir; diğer
// olaylarda yalnızca app_user_id etkilenir.
function affectedUserIds(event) {
  if (event.type === "TRANSFER") {
    return [...(event.transferred_from || []), ...(event.transferred_to || [])];
  }
  return event.app_user_id ? [event.app_user_id] : [];
}

// POST /api/webhooks/revenuecat — RevenueCat'ten gelen abonelik olayları.
// app_user_id, mobil tarafta Purchases.logIn ile ayarlanan Supabase
// kullanıcı id'sidir. Olay tipine göre planı tahmin etmek yerine her
// olayda RevenueCat'ten güncel entitlement durumunu çekip yazıyoruz; böylece
// iade, iptal ve transfer gibi durumlar da doğru yansır.
router.post("/revenuecat", async (req, res) => {
  if (!isValidWebhookSecret(req.headers.authorization)) {
    return res.status(401).json({ error: "Geçersiz webhook secret" });
  }

  const event = req.body?.event;

  if (!event || !event.type) {
    return res.status(400).json({ error: "Geçersiz webhook gövdesi" });
  }

  // Anonim RevenueCat id'leri ($RCAnonymousID:...) ve TEST olayları gibi
  // UUID olmayan kullanıcıları atlıyoruz; 200 dönüyoruz ki RevenueCat
  // tekrar denemesin.
  const userIds = [...new Set(affectedUserIds(event))];
  const validUserIds = userIds.filter(isValidUserId);
  const skippedUserIds = userIds.filter((id) => !isValidUserId(id));

  if (skippedUserIds.length > 0) {
    console.warn(
      `[webhook] ${event.type} olayında geçersiz app_user_id atlandı: ${skippedUserIds.join(", ")}`
    );
  }

  if (validUserIds.length === 0) {
    return res.status(200).json({ received: true, skipped: true });
  }

  try {
    for (const userId of validUserIds) {
      await syncPlanFromRevenueCat(userId);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    // 5xx dönünce RevenueCat olayı daha sonra tekrar gönderir.
    console.error(`[webhook] ${event.type} olayı işlenemedi:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

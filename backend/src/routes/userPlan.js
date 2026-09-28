const express = require("express");

const db = require("../config/db");
const requireAuth = require("../middleware/requireAuth");
const { getEffectivePlan } = require("../services/planService");

const router = express.Router();

router.use(requireAuth);

// POST /api/user/plan/sync — satın alma tamamlandıktan hemen sonra,
// webhook'un gelmesini beklemeden RevenueCat'ten güncel entitlement
// durumunu çekip planı günceller.
router.post("/sync", async (req, res) => {
  const secretKey = process.env.REVENUECAT_SECRET_KEY;

  if (!secretKey) {
    return res.status(500).json({ error: "REVENUECAT_SECRET_KEY tanımlı değil" });
  }

  try {
    const response = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(req.user.id)}`,
      { headers: { Authorization: `Bearer ${secretKey}` } }
    );

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return res
        .status(502)
        .json({ error: `RevenueCat isteği başarısız (${response.status}): ${text}` });
    }

    const data = await response.json();
    const entitlements = Object.values(data.subscriber?.entitlements || {});
    const now = new Date();
    const activeEntitlements = entitlements.filter(
      (entitlement) => !entitlement.expires_date || new Date(entitlement.expires_date) > now
    );

    if (activeEntitlements.length > 0) {
      // expires_date null olan (lifetime) bir entitlement varsa süresiz
      // premium; yoksa en geç biten entitlement'ı premium_expires_at yap.
      const lifetime = activeEntitlements.some((entitlement) => !entitlement.expires_date);
      const latestExpiresAt = lifetime
        ? null
        : activeEntitlements.reduce((latest, entitlement) => {
            const expiresAt = new Date(entitlement.expires_date);
            return !latest || expiresAt > latest ? expiresAt : latest;
          }, null);

      await db.query("update users set plan = 'premium', premium_expires_at = $2 where id = $1", [
        req.user.id,
        latestExpiresAt,
      ]);
    } else {
      await db.query("update users set plan = 'free' where id = $1", [req.user.id]);
    }

    const { plan, premium_expires_at } = await getEffectivePlan(req.user.id);
    res.json({ plan, premium_expires_at });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

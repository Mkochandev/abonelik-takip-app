const express = require("express");

const requireAuth = require("../middleware/requireAuth");
const { RevenueCatError, syncPlanFromRevenueCat } = require("../services/planService");

const router = express.Router();

router.use(requireAuth);

// POST /api/user/plan/sync — satın alma tamamlandıktan hemen sonra,
// webhook'un gelmesini beklemeden RevenueCat'ten güncel entitlement
// durumunu çekip planı günceller.
router.post("/sync", async (req, res) => {
  try {
    const { plan, premium_expires_at } = await syncPlanFromRevenueCat(req.user.id);
    res.json({ plan, premium_expires_at });
  } catch (error) {
    const status = error instanceof RevenueCatError ? 502 : 500;
    res.status(status).json({ error: error.message });
  }
});

module.exports = router;

const express = require("express");

const adminRoutes = require("./admin");
const adminConfigRoutes = require("./adminConfig");
const authRoutes = require("./auth");
const catalogRoutes = require("./catalog");
const kivirikRoutes = require("./kivirik");
const subscriptionsRoutes = require("./subscriptions");
const userPlanRoutes = require("./userPlan");
const userSettingsRoutes = require("./userSettings");
const webhooksRoutes = require("./webhooks");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({ message: "Abonelik Takip API" });
});

router.use("/auth", authRoutes);
router.use("/catalog", catalogRoutes);
router.use("/user/subscriptions", subscriptionsRoutes);
router.use("/user/plan", userPlanRoutes);
router.use("/user/settings", userSettingsRoutes);
router.use("/kivirik", kivirikRoutes);
router.use("/admin/catalog", adminRoutes);
router.use("/admin/config", adminConfigRoutes);
router.use("/webhooks", webhooksRoutes);

module.exports = router;

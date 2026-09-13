const express = require("express");

const adminRoutes = require("./admin");
const authRoutes = require("./auth");
const catalogRoutes = require("./catalog");
const subscriptionsRoutes = require("./subscriptions");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({ message: "Abonelik Takip API" });
});

router.use("/auth", authRoutes);
router.use("/catalog", catalogRoutes);
router.use("/user/subscriptions", subscriptionsRoutes);
router.use("/admin/catalog", adminRoutes);

module.exports = router;

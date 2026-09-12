const express = require("express");

const authRoutes = require("./auth");
const catalogRoutes = require("./catalog");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({ message: "Abonelik Takip API" });
});

router.use("/auth", authRoutes);
router.use("/catalog", catalogRoutes);

module.exports = router;

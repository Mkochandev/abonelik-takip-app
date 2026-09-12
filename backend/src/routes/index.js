const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({ message: "Abonelik Takip API" });
});

module.exports = router;

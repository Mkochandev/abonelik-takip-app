const express = require("express");

const requireAdminSecret = require("../middleware/requireAdminSecret");

const router = express.Router();

router.use(requireAdminSecret);

// GET /api/admin/config — admin panelin logo önizlemesi için ihtiyaç
// duyduğu Logo.dev yayınlanabilir (publishable) anahtarı
router.get("/", (req, res) => {
  res.json({ logodevKey: process.env.LOGODEV_PUBLISHABLE_KEY || null });
});

module.exports = router;

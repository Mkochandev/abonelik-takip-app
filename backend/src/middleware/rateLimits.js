// Auth endpoint'leri için istek sınırları. Sayaçlar bellekte tutulur (tek
// süreç). IP sınırları gevşek tutuldu: mobil operatörlerde çok sayıda
// kullanıcı aynı IP'yi paylaşır (CGNAT). Asıl koruma e-posta başına sınır.

const { rateLimit } = require("express-rate-limit");

const { normalizeEmail } = require("../services/authService");

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

function limiter({ windowMs, limit, keyGenerator, skip }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    ...(keyGenerator ? { keyGenerator } : {}),
    ...(skip ? { skip } : {}),
    handler: (req, res) => {
      res.status(429).json({
        error: "Çok fazla deneme yaptın. Biraz bekleyip tekrar dene.",
        code: "rate_limited",
      });
    },
  });
}

// Gövdedeki e-postaya göre anahtar; e-posta yoksa bu sınır atlanır (IP
// sınırı yine geçerli).
function byEmail({ windowMs, limit }) {
  return limiter({
    windowMs,
    limit,
    keyGenerator: (req) => `email:${normalizeEmail(req.body?.email)}`,
    skip: (req) => !normalizeEmail(req.body?.email),
  });
}

module.exports = {
  loginLimiters: [
    limiter({ windowMs: 15 * MINUTE, limit: 30 }),
    byEmail({ windowMs: 15 * MINUTE, limit: 10 }),
  ],
  // Deneme yoluyla kayıtlı e-posta taramayı yavaşlatır.
  registerLimiters: [limiter({ windowMs: HOUR, limit: 10 })],
  forgotPasswordLimiters: [
    limiter({ windowMs: HOUR, limit: 10 }),
    byEmail({ windowMs: HOUR, limit: 3 }),
  ],
  resetPasswordLimiters: [limiter({ windowMs: 15 * MINUTE, limit: 10 })],
  refreshLimiters: [limiter({ windowMs: 15 * MINUTE, limit: 120 })],
};

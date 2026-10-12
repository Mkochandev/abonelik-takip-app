const express = require("express");

const requireAuth = require("../middleware/requireAuth");
const {
  forgotPasswordLimiters,
  loginLimiters,
  refreshLimiters,
  registerLimiters,
  resetPasswordLimiters,
} = require("../middleware/rateLimits");
const authService = require("../services/authService");
const {
  FREE_LIMIT,
  deleteRevenueCatSubscriber,
  getEffectivePlan,
  getSubscriptionCount,
} = require("../services/planService");

const router = express.Router();

// Beklenmeyen hatalarda ayrıntı istemciye gitmez, loga yazılır.
function handleError(res, error, context) {
  if (error instanceof authService.AuthError) {
    return res.status(error.status).json({ error: error.message, code: error.code });
  }
  console.error(`[auth] ${context}:`, error);
  return res.status(500).json({ error: "Bir hata oluştu, tekrar dene" });
}

function requireCredentials(req, res) {
  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    res.status(400).json({ error: "email ve password zorunludur", code: "missing_credentials" });
    return null;
  }
  return { email, password };
}

// POST /api/auth/register — { email, password } → 201 { user, session }
router.post("/register", registerLimiters, async (req, res) => {
  const credentials = requireCredentials(req, res);
  if (!credentials) return;

  try {
    const result = await authService.register(credentials.email, credentials.password);
    res.status(201).json(result);
  } catch (error) {
    handleError(res, error, "register");
  }
});

// POST /api/auth/login — { email, password } → { user, session }
router.post("/login", loginLimiters, async (req, res) => {
  const credentials = requireCredentials(req, res);
  if (!credentials) return;

  try {
    res.json(await authService.login(credentials.email, credentials.password));
  } catch (error) {
    handleError(res, error, "login");
  }
});

// POST /api/auth/refresh — { refresh_token } → { user, session }
// Refresh token döner: yanıttaki yeni token saklanmalı, eskisi artık geçersiz.
router.post("/refresh", refreshLimiters, async (req, res) => {
  try {
    res.json(await authService.refreshSession(req.body?.refresh_token));
  } catch (error) {
    handleError(res, error, "refresh");
  }
});

// POST /api/auth/logout — { refresh_token } → 204. Access token gerekmez
// (süresi dolmuş oturumdan da çıkılabilsin); token yoksa da 204.
router.post("/logout", async (req, res) => {
  try {
    await authService.revokeRefreshToken(req.body?.refresh_token);
    res.status(204).send();
  } catch (error) {
    handleError(res, error, "logout");
  }
});

// POST /api/auth/forgot-password — { email } → her durumda aynı yanıt
// (e-postanın kayıtlı olup olmadığı belli olmaz).
router.post("/forgot-password", forgotPasswordLimiters, async (req, res) => {
  try {
    await authService.requestPasswordReset(req.body?.email);
  } catch (error) {
    console.error("[auth] forgot-password:", error);
  }
  res.json({
    ok: true,
    message: "Eğer bu e-postayla bir hesap varsa sıfırlama bağlantısı gönderdik.",
  });
});

// POST /api/auth/reset-password — { token, password } → { ok: true }
// Başarılıysa kullanıcının bütün oturumları kapanır.
router.post("/reset-password", resetPasswordLimiters, async (req, res) => {
  try {
    await authService.resetPassword(req.body?.token, req.body?.password);
    res.json({ ok: true });
  } catch (error) {
    handleError(res, error, "reset-password");
  }
});

// GET /api/auth/me
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await authService.getUser(req.user.id);
    if (!user) {
      return res.status(401).json({ error: "Geçersiz veya süresi dolmuş token" });
    }

    const { plan, premium_expires_at } = await getEffectivePlan(req.user.id);
    const subscription_count = await getSubscriptionCount(req.user.id);

    res.json({
      user,
      plan,
      premium_expires_at,
      limit: plan === "free" ? FREE_LIMIT : null,
      subscription_count,
    });
  } catch (error) {
    handleError(res, error, "me");
  }
});

// DELETE /api/auth/me — hesabı ve bütün verisini siler (App Store 5.1.1).
// RevenueCat'teki müşteri kaydı da silinir; o adım başarısız olursa hesap
// yine silinir, hata loglanır. App Store aboneliği bununla iptal olmaz.
async function deleteAccount(req, res) {
  try {
    await authService.deleteUser(req.user.id);
  } catch (error) {
    return handleError(res, error, "delete account");
  }

  deleteRevenueCatSubscriber(req.user.id).catch((error) => {
    console.error(`[auth] RevenueCat müşterisi silinemedi (${req.user.id}):`, error.message);
  });

  res.status(204).send();
}

router.delete("/me", requireAuth, deleteAccount);
// Eski mobil sürümler için.
router.delete("/account", requireAuth, deleteAccount);

module.exports = router;

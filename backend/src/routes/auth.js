const express = require("express");

const supabaseAdmin = require("../config/supabaseClient");
const supabaseAnon = require("../config/supabaseAnonClient");
const requireAuth = require("../middleware/requireAuth");
const { FREE_LIMIT, getEffectivePlan, getSubscriptionCount } = require("../services/planService");

const router = express.Router();

router.post("/register", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "email ve password zorunludur" });
  }

  const { data, error } = await supabaseAnon.auth.signUp({ email, password });

  if (error) {
    return res.status(400).json({ error: error.message, code: error.code });
  }

  res.status(201).json({ user: data.user, session: data.session });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "email ve password zorunludur" });
  }

  const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });

  if (error) {
    return res.status(401).json({ error: error.message, code: error.code });
  }

  res.json({ user: data.user, session: data.session });
});

router.post("/refresh", async (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({ error: "refresh_token zorunludur" });
  }

  const { data, error } = await supabaseAnon.auth.refreshSession({ refresh_token });

  if (error || !data.session) {
    return res.status(401).json({ error: error?.message || "Oturum yenilenemedi" });
  }

  res.json({ user: data.user, session: data.session });
});

router.delete("/account", requireAuth, async (req, res) => {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(req.user.id);

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.status(204).send();
});

router.post("/logout", requireAuth, async (req, res) => {
  const { error } = await supabaseAdmin.auth.admin.signOut(req.token);

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.status(204).send();
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const { plan, premium_expires_at } = await getEffectivePlan(req.user.id);
    const subscription_count = await getSubscriptionCount(req.user.id);

    res.json({
      user: req.user,
      plan,
      premium_expires_at,
      limit: plan === "free" ? FREE_LIMIT : null,
      subscription_count,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

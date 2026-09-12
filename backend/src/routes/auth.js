const express = require("express");

const supabaseAdmin = require("../config/supabaseClient");
const supabaseAnon = require("../config/supabaseAnonClient");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

router.post("/register", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "email ve password zorunludur" });
  }

  const { data, error } = await supabaseAnon.auth.signUp({ email, password });

  if (error) {
    return res.status(400).json({ error: error.message });
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
    return res.status(401).json({ error: error.message });
  }

  res.json({ user: data.user, session: data.session });
});

router.post("/logout", requireAuth, async (req, res) => {
  const { error } = await supabaseAdmin.auth.admin.signOut(req.token);

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.status(204).send();
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;

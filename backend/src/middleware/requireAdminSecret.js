function requireAdminSecret(req, res, next) {
  const providedSecret = req.headers["x-admin-secret"];

  if (!process.env.ADMIN_SECRET) {
    return res.status(500).json({ error: "ADMIN_SECRET tanımlı değil" });
  }

  if (!providedSecret || providedSecret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: "Geçersiz admin secret" });
  }

  next();
}

module.exports = requireAdminSecret;

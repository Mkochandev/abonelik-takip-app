const supabaseAnon = require("../config/supabaseAnonClient");

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Yetkilendirme başlığı eksik veya geçersiz" });
  }

  const { data, error } = await supabaseAnon.auth.getUser(token);

  if (error || !data.user) {
    return res.status(401).json({ error: "Geçersiz veya süresi dolmuş token" });
  }

  req.user = data.user;
  req.token = token;
  next();
}

module.exports = requireAuth;

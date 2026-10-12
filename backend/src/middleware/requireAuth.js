const db = require("../config/db");
const { verifyAccessToken } = require("../services/authService");

// Authorization: Bearer <access token> (JWT). Token geçerliyse ve kullanıcı
// hâlâ varsa req.user = { id }. Kullanıcı kontrolü, silinen hesabın kalan
// token ömrü boyunca istek atamaması içindir.
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Yetkilendirme başlığı eksik veya geçersiz" });
  }

  const userId = verifyAccessToken(token);

  if (!userId) {
    return res.status(401).json({ error: "Geçersiz veya süresi dolmuş token" });
  }

  try {
    const { rows } = await db.query("select 1 from users where id = $1", [userId]);
    if (rows.length === 0) {
      return res.status(401).json({ error: "Geçersiz veya süresi dolmuş token" });
    }
  } catch (error) {
    return next(error);
  }

  req.user = { id: userId };
  next();
}

module.exports = requireAuth;

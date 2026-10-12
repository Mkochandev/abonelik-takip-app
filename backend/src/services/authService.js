// Giriş sistemi: şifreler (bcrypt), access token (JWT, HS256), refresh
// token (rastgele, veritabanında yalnızca SHA-256 hash'i) ve şifre
// sıfırlama token'ları.
//
// Refresh token her kullanımda döner (rotasyon): eskisi iptal edilir,
// yenisi verilir. İptal edilmiş bir token tekrar gelirse token çalınmış
// sayılır ve kullanıcının bütün refresh token'ları iptal edilir.

const crypto = require("crypto");

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const db = require("../config/db");
const { sendPasswordResetEmail } = require("./mailer");
const { withTransaction } = require("./planService");

const BCRYPT_COST = 12;
const MIN_PASSWORD_LENGTH = 8;
// bcrypt, 72 bayttan sonrasını yok sayar; daha uzun şifreleri reddediyoruz
// ki kullanıcı fark etmeden kısalmış bir şifreyle kalmasın.
const MAX_PASSWORD_BYTES = 72;
const MAX_EMAIL_LENGTH = 254;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ACCESS_TOKEN_TTL (saniye) testte kısaltılabilir.
const ACCESS_TOKEN_TTL_SECONDS = Number(process.env.ACCESS_TOKEN_TTL) || 15 * 60;
const REFRESH_TOKEN_TTL_DAYS = 60;
const PASSWORD_RESET_TTL_MINUTES = 60;

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET tanımlı olmalı ve en az 32 karakter olmalı");
}

// Kullanıcı bulunamadığında da bcrypt karşılaştırması yapılır ki yanıt
// süresinden e-postanın kayıtlı olup olmadığı anlaşılmasın.
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", BCRYPT_COST);
const BCRYPT_HASH_REGEX = /^\$2[aby]\$\d{2}\$/;

// Hata kodları mobilin çevirdiği Supabase kodlarıyla aynı tutuldu.
class AuthError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function validateEmail(email) {
  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_REGEX.test(email)) {
    throw new AuthError(400, "invalid_email", "Geçerli bir e-posta adresi gir");
  }
}

function validatePassword(password) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    throw new AuthError(400, "weak_password", `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı`);
  }
  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
    throw new AuthError(400, "password_too_long", "Şifre çok uzun");
  }
}

function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_COST);
}

async function verifyPassword(password, hash) {
  if (typeof password !== "string" || !BCRYPT_HASH_REGEX.test(hash || "")) {
    await bcrypt.compare(String(password ?? ""), DUMMY_HASH);
    return false;
  }
  return bcrypt.compare(password, hash);
}

function randomToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    created_at: row.created_at,
    email_verified_at: row.email_verified_at,
  };
}

const USER_COLUMNS = "id, email, created_at, email_verified_at";

function signAccessToken(userId) {
  return jwt.sign({}, JWT_SECRET, {
    algorithm: "HS256",
    subject: userId,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  });
}

// Geçerliyse kullanıcı id'sini, değilse null döner.
function verifyAccessToken(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

// Yeni refresh token'ı kaydeder; { id, token } döner.
async function insertRefreshToken(client, userId) {
  const token = randomToken();
  const { rows } = await client.query(
    `insert into refresh_tokens (user_id, token_hash, expires_at)
     values ($1, $2, now() + make_interval(days => $3))
     returning id`,
    [userId, hashToken(token), REFRESH_TOKEN_TTL_DAYS]
  );
  return { id: rows[0].id, token };
}

// Mobilin beklediği (Supabase ile aynı) oturum biçimi.
function sessionPayload(userId, refreshToken) {
  const accessToken = signAccessToken(userId);
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "bearer",
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    expires_at: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS,
  };
}

async function createSession(userId, client = db) {
  // Süresi geçmiş token'lar artık tekrar kullanım tespitine de yaramaz.
  await client.query("delete from refresh_tokens where user_id = $1 and expires_at < now()", [
    userId,
  ]);
  const { token } = await insertRefreshToken(client, userId);
  return sessionPayload(userId, token);
}

async function register(rawEmail, password) {
  const email = normalizeEmail(rawEmail);
  validateEmail(email);
  validatePassword(password);

  const passwordHash = await hashPassword(password);

  try {
    return await withTransaction(async (client) => {
      const { rows } = await client.query(
        `insert into users (email, password_hash) values ($1, $2) returning ${USER_COLUMNS}`,
        [email, passwordHash]
      );
      const user = rows[0];
      return { user: publicUser(user), session: await createSession(user.id, client) };
    });
  } catch (error) {
    if (error.code === "23505") {
      throw new AuthError(409, "user_already_exists", "Bu e-posta adresiyle zaten bir hesap var");
    }
    throw error;
  }
}

async function login(rawEmail, password) {
  const email = normalizeEmail(rawEmail);
  const { rows } = await db.query(
    `select ${USER_COLUMNS}, password_hash from users where email = $1`,
    [email]
  );
  const user = rows[0];
  const valid = await verifyPassword(password, user?.password_hash);

  if (!user || !valid) {
    throw new AuthError(401, "invalid_credentials", "E-posta veya şifre hatalı");
  }

  // Supabase'den gelen hash'ler daha düşük maliyetli; girişte yükseltilir.
  if (bcrypt.getRounds(user.password_hash) < BCRYPT_COST) {
    const upgraded = await hashPassword(password);
    await db.query("update users set password_hash = $2 where id = $1", [user.id, upgraded]);
  }

  return { user: publicUser(user), session: await createSession(user.id) };
}

async function refreshSession(refreshToken) {
  if (typeof refreshToken !== "string" || !refreshToken) {
    throw new AuthError(401, "invalid_refresh_token", "Oturum yenilenemedi");
  }

  const result = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `select id, user_id, expires_at, revoked_at, replaced_by from refresh_tokens
       where token_hash = $1 for update`,
      [hashToken(refreshToken)]
    );
    const current = rows[0];

    if (!current) {
      return { error: true };
    }

    // Çıkış ya da şifre sıfırlamayla iptal edilen token (replaced_by boş)
    // yalnızca reddedilir.
    if (current.revoked_at && !current.replaced_by) {
      return { error: true };
    }

    if (current.revoked_at) {
      // Rotasyonla değiştirilmiş token tekrar geldi: çalınmış olabilir,
      // bütün oturumlar kapanır.
      await client.query(
        "update refresh_tokens set revoked_at = now() where user_id = $1 and revoked_at is null",
        [current.user_id]
      );
      console.warn(`[auth] iptal edilmiş refresh token tekrar kullanıldı, kullanıcı ${current.user_id} için bütün oturumlar kapatıldı`);
      return { error: true };
    }

    if (new Date(current.expires_at) <= new Date()) {
      return { error: true };
    }

    const next = await insertRefreshToken(client, current.user_id);
    await client.query(
      "update refresh_tokens set revoked_at = now(), replaced_by = $2 where id = $1",
      [current.id, next.id]
    );

    const { rows: userRows } = await client.query(
      `select ${USER_COLUMNS} from users where id = $1`,
      [current.user_id]
    );

    return { user: publicUser(userRows[0]), session: sessionPayload(current.user_id, next.token) };
  });

  if (result.error) {
    throw new AuthError(401, "invalid_refresh_token", "Oturum yenilenemedi");
  }

  return result;
}

async function revokeRefreshToken(refreshToken) {
  if (typeof refreshToken !== "string" || !refreshToken) {
    return;
  }
  await db.query(
    "update refresh_tokens set revoked_at = now() where token_hash = $1 and revoked_at is null",
    [hashToken(refreshToken)]
  );
}

async function getUser(userId) {
  const { rows } = await db.query(`select ${USER_COLUMNS} from users where id = $1`, [userId]);
  return rows[0] ? publicUser(rows[0]) : null;
}

function resetLink(token) {
  const base = (process.env.APP_BASE_URL || "https://eriste.app").replace(/\/+$/, "");
  return `${base}/sifre-sifirla?token=${encodeURIComponent(token)}`;
}

// E-posta kayıtlı olsun olmasın aynı şekilde döner; e-posta gönderimi
// yanıtı bekletmez (süre farkından da bilgi sızmasın).
async function requestPasswordReset(rawEmail) {
  const email = normalizeEmail(rawEmail);
  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_REGEX.test(email)) {
    return;
  }

  const { rows } = await db.query("select id, email from users where email = $1", [email]);
  const user = rows[0];
  if (!user) {
    return;
  }

  const token = randomToken();
  await withTransaction(async (client) => {
    // Önceki kullanılmamış bağlantılar geçersiz olur; yalnızca en son gelen çalışır.
    await client.query(
      "update password_reset_tokens set used_at = now() where user_id = $1 and used_at is null",
      [user.id]
    );
    await client.query(
      `insert into password_reset_tokens (user_id, token_hash, expires_at)
       values ($1, $2, now() + make_interval(mins => $3))`,
      [user.id, hashToken(token), PASSWORD_RESET_TTL_MINUTES]
    );
  });

  sendPasswordResetEmail(user.email, resetLink(token), PASSWORD_RESET_TTL_MINUTES).catch((error) => {
    console.error("[auth] şifre sıfırlama e-postası gönderilemedi:", error.message);
  });
}

// Şifreyi değiştirir ve kullanıcının bütün oturumlarını kapatır.
async function resetPassword(token, password) {
  validatePassword(password);

  if (typeof token !== "string" || !token) {
    throw new AuthError(400, "invalid_reset_token", "Bağlantı geçersiz ya da süresi dolmuş");
  }

  const passwordHash = await hashPassword(password);

  const ok = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `select id, user_id from password_reset_tokens
       where token_hash = $1 and used_at is null and expires_at > now()
       for update`,
      [hashToken(token)]
    );
    const resetToken = rows[0];

    if (!resetToken) {
      return false;
    }

    await client.query(
      "update password_reset_tokens set used_at = now() where user_id = $1 and used_at is null",
      [resetToken.user_id]
    );
    // Bağlantıya tıklayabildiyse e-posta adresi de doğrulanmış olur.
    await client.query(
      `update users
       set password_hash = $2, email_verified_at = coalesce(email_verified_at, now())
       where id = $1`,
      [resetToken.user_id, passwordHash]
    );
    await client.query(
      "update refresh_tokens set revoked_at = now() where user_id = $1 and revoked_at is null",
      [resetToken.user_id]
    );
    return true;
  });

  if (!ok) {
    throw new AuthError(400, "invalid_reset_token", "Bağlantı geçersiz ya da süresi dolmuş");
  }
}

// Kullanıcıyı ve (CASCADE ile) bütün verisini siler.
async function deleteUser(userId) {
  const { rowCount } = await db.query("delete from users where id = $1", [userId]);
  return rowCount > 0;
}

module.exports = {
  ACCESS_TOKEN_TTL_SECONDS,
  AuthError,
  deleteUser,
  getUser,
  login,
  normalizeEmail,
  refreshSession,
  register,
  requestPasswordReset,
  resetPassword,
  revokeRefreshToken,
  verifyAccessToken,
};

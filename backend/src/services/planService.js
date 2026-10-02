const db = require("../config/db");
const { FREE_LIMIT } = require("../config/plan");

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUserId(value) {
  return typeof value === "string" && UUID_REGEX.test(value);
}

// RevenueCat REST API isteği başarısız olduğunda fırlatılır; route'lar bunu
// 502 olarak döndürebilsin diye ayrı bir hata tipi.
class RevenueCatError extends Error {
  constructor(status, body) {
    super(`RevenueCat isteği başarısız (${status}): ${body}`);
    this.name = "RevenueCatError";
    this.status = status;
  }
}

// premium_expires_at geçmişse kullanıcıyı free say (webhook/sync gecikmiş
// ya da hiç gelmemiş olabilir; süresi geçen bir premium'u asla güvenmeyiz).
function toEffectivePlan(row) {
  if (!row) {
    return { plan: "free", premium_expires_at: null };
  }

  const isExpired =
    row.plan === "premium" &&
    row.premium_expires_at &&
    new Date(row.premium_expires_at) < new Date();

  return {
    plan: isExpired ? "free" : row.plan,
    premium_expires_at: row.premium_expires_at,
  };
}

async function getEffectivePlan(userId) {
  const { rows } = await db.query(
    "select plan, premium_expires_at from users where id = $1",
    [userId]
  );

  return toEffectivePlan(rows[0]);
}

// Verilen fonksiyonu tek bir transaction içinde, aynı bağlantı (client)
// üzerinden çalıştırır; hata olursa geri alır.
async function withTransaction(fn) {
  const client = await db.connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

// Transaction içinde çağrılmalı. Kullanıcının users satırını FOR UPDATE ile
// kilitler; böylece aynı kullanıcı için eşzamanlı ekleme istekleri sırayla
// çalışır ve "say → ekle" arasında limit aşılamaz. users satırı henüz
// oluşmamışsa (senkron tetikleyicisi gecikmişse) aynı garantiyi advisory
// lock ile sağlarız.
async function lockUserAndGetPlan(client, userId) {
  const { rows } = await client.query(
    "select plan, premium_expires_at from users where id = $1 for update",
    [userId]
  );

  if (rows.length === 0) {
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [userId]);
  }

  return toEffectivePlan(rows[0]);
}

// RevenueCat'ten kullanıcının güncel entitlement durumunu çekip users
// tablosundaki planı buna göre yazar. Webhook olay tipine güvenmek yerine
// her seferinde kaynaktan okuduğumuz için iade, iptal, transfer gibi
// durumlar da doğru yansır.
async function syncPlanFromRevenueCat(userId) {
  const secretKey = process.env.REVENUECAT_SECRET_KEY;

  if (!secretKey) {
    throw new Error("REVENUECAT_SECRET_KEY tanımlı değil");
  }

  const response = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
    { headers: { Authorization: `Bearer ${secretKey}` } }
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new RevenueCatError(response.status, text);
  }

  const data = await response.json();
  const entitlements = Object.values(data.subscriber?.entitlements || {});
  const now = new Date();
  const activeEntitlements = entitlements.filter(
    (entitlement) => !entitlement.expires_date || new Date(entitlement.expires_date) > now
  );

  if (activeEntitlements.length > 0) {
    // expires_date null olan (lifetime) bir entitlement varsa süresiz
    // premium; yoksa en geç biten entitlement'ı premium_expires_at yap.
    const lifetime = activeEntitlements.some((entitlement) => !entitlement.expires_date);
    const latestExpiresAt = lifetime
      ? null
      : activeEntitlements.reduce((latest, entitlement) => {
          const expiresAt = new Date(entitlement.expires_date);
          return !latest || expiresAt > latest ? expiresAt : latest;
        }, null);

    await db.query("update users set plan = 'premium', premium_expires_at = $2 where id = $1", [
      userId,
      latestExpiresAt,
    ]);
  } else {
    await db.query("update users set plan = 'free' where id = $1", [userId]);
  }

  return getEffectivePlan(userId);
}

// client verilirse (transaction içi) sayım o bağlantı üzerinden yapılır.
async function getSubscriptionCount(userId, client = db) {
  const { rows } = await client.query(
    "select count(*)::int as count from user_subscriptions where user_id = $1",
    [userId]
  );

  return rows[0].count;
}

module.exports = {
  FREE_LIMIT,
  RevenueCatError,
  UUID_REGEX,
  getEffectivePlan,
  getSubscriptionCount,
  isValidUserId,
  lockUserAndGetPlan,
  syncPlanFromRevenueCat,
  withTransaction,
};

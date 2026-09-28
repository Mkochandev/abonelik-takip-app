const db = require("../config/db");
const { FREE_LIMIT } = require("../config/plan");

// premium_expires_at geçmişse kullanıcıyı free say (webhook/sync gecikmiş
// ya da hiç gelmemiş olabilir; süresi geçen bir premium'u asla güvenmeyiz).
async function getEffectivePlan(userId) {
  const { rows } = await db.query(
    "select plan, premium_expires_at from users where id = $1",
    [userId]
  );

  const row = rows[0];
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

async function getSubscriptionCount(userId) {
  const { rows } = await db.query(
    "select count(*)::int as count from user_subscriptions where user_id = $1",
    [userId]
  );

  return rows[0].count;
}

module.exports = { FREE_LIMIT, getEffectivePlan, getSubscriptionCount };

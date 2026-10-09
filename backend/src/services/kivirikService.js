// Kıvırık soru motoru: bekleyen soruları anlık hesaplar (cron yok) ve
// cevapları ilgili alanlara yazar. Hangi sorunun ne zaman sorulacağı
// src/kivirik/questions.js'te.

const db = require("../config/db");
const { QUESTIONS, QUESTIONS_BY_KEY } = require("../kivirik/questions");
const { getUsdToTryRate } = require("./exchangeRate");
const {
  SUBSCRIPTION_WITH_CATALOG_COLUMNS,
  monthlyPriceTry,
  parseBillingFields,
  withPriceTry,
} = require("./subscriptionRows");

const MAX_QUESTIONS = 3;
const LATER_DAYS = 7;
const TIME_ZONE = "Europe/Istanbul";
const MAX_AMOUNT = 1_000_000;

// Kullanıcının istemciden değiştirebildiği ayar kolonları (whitelist).
const SETTINGS_COLUMNS = ["reminder_days_before", "is_student", "monthly_budget"];

const EMPTY_SETTINGS = { reminder_days_before: null, is_student: null, monthly_budget: null };

class KivirikError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// Europe/Istanbul'a göre bugünün tarihi: 'YYYY-MM-DD'.
function istanbulToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now);
}

async function getSettings(userId, client = db) {
  const { rows } = await client.query(
    `select reminder_days_before, is_student, monthly_budget
     from user_settings where user_id = $1`,
    [userId]
  );
  const row = rows[0];
  return row
    ? {
        reminder_days_before: row.reminder_days_before,
        is_student: row.is_student,
        monthly_budget: row.monthly_budget == null ? null : Number(row.monthly_budget),
      }
    : { ...EMPTY_SETTINGS };
}

async function updateSettings(userId, values, client = db) {
  const columns = Object.keys(values).filter((column) => SETTINGS_COLUMNS.includes(column));
  if (columns.length === 0) {
    return getSettings(userId, client);
  }
  const placeholders = columns.map((_, index) => `$${index + 2}`);
  const updates = columns.map((column) => `${column} = excluded.${column}`);
  await client.query(
    `insert into user_settings (user_id, ${columns.join(", ")})
     values ($1, ${placeholders.join(", ")})
     on conflict (user_id) do update set ${updates.join(", ")}, updated_at = now()`,
    [userId, ...columns.map((column) => values[column])]
  );
  return getSettings(userId, client);
}

// Sorulara aday abonelikler: iptal edilmemiş ve uygulamanın yönetmediği
// (erişte Premium'un fiyatı, günü ve kanalı zaten bilinir).
async function loadSubscriptions(userId, client = db) {
  const { rows } = await client.query(
    `select ${SUBSCRIPTION_WITH_CATALOG_COLUMNS}
     from user_subscriptions us
     join subscriptions_catalog sc on sc.id = us.catalog_id
     where us.user_id = $1 and us.cancelled_at is null and sc.managed_by is null`,
    [userId]
  );
  const usdToTryRate = await getUsdToTryRate();
  return rows.map((row) => withPriceTry(row, usdToTryRate));
}

function stateKey(key, subscriptionId, period) {
  return `${key}|${subscriptionId ?? ""}|${period}`;
}

// Kartın üst şeridi ve metinlerde kullanılan değerler.
function subscriptionParams(sub) {
  return {
    app_name: sub.app_name,
    plan_name: sub.plan_name,
    domain: sub.domain,
    logo_url: sub.logo_url,
    category: sub.category,
    price: sub.current_price == null ? null : Number(sub.current_price),
    currency: sub.currency,
    price_try: sub.current_price_try,
    billing_cycle: sub.billing_cycle,
    billing_date: sub.billing_date,
    billing_month: sub.billing_month,
    usage_frequency: sub.usage_frequency,
    payment_channel: sub.payment_channel,
  };
}

// Bekleyen sorular: öncelik sırasıyla, aynı öncelikte pahalı abonelik önce.
async function getPendingQuestions(userId) {
  const now = new Date();
  const [settings, subs, answersResult, dismissalsResult] = await Promise.all([
    getSettings(userId),
    loadSubscriptions(userId),
    db.query(
      "select question_key, user_subscription_id, period from kivirik_answers where user_id = $1",
      [userId]
    ),
    db.query(
      `select question_key, user_subscription_id from kivirik_dismissals
       where user_id = $1 and (until is null or until > now())`,
      [userId]
    ),
  ]);

  const answered = new Set(
    answersResult.rows.map((row) => stateKey(row.question_key, row.user_subscription_id, row.period))
  );
  const dismissed = new Set(
    dismissalsResult.rows.map((row) => stateKey(row.question_key, row.user_subscription_id, "-"))
  );
  const todayIso = istanbulToday(now);
  const pending = [];

  for (const question of QUESTIONS) {
    const period = question.period === "once" ? "once" : null;
    if (!period) continue; // Periyodik/tetiklemeli sorular sonraki fazlarda.

    if (question.scope === "user") {
      if (
        question.when({ subs, settings, now: now.getTime(), todayIso }) &&
        !answered.has(stateKey(question.key, null, period)) &&
        !dismissed.has(stateKey(question.key, null, "-"))
      ) {
        pending.push({
          key: question.key,
          user_subscription_id: null,
          period,
          priority: question.priority,
          sortPrice: -1,
          params: question.key === "monthly_budget" || question.key === "store_check"
            ? { subscription_count: subs.length }
            : {},
        });
      }
      continue;
    }

    for (const sub of subs) {
      if (
        question.when({ sub, settings, now: now.getTime(), todayIso }) &&
        !answered.has(stateKey(question.key, sub.id, period)) &&
        !dismissed.has(stateKey(question.key, sub.id, "-"))
      ) {
        pending.push({
          key: question.key,
          user_subscription_id: sub.id,
          period,
          priority: question.priority,
          sortPrice: monthlyPriceTry(sub),
          params: subscriptionParams(sub),
        });
      }
    }
  }

  pending.sort((a, b) => a.priority - b.priority || b.sortPrice - a.sortPrice);

  return {
    total: pending.length,
    questions: pending
      .slice(0, MAX_QUESTIONS)
      .map(({ sortPrice, priority, ...question }) => question),
  };
}

function parseAmount(value) {
  const amount = typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) {
    throw new KivirikError("Geçersiz tutar");
  }
  return Math.round(amount * 100) / 100;
}

// Bugün ya da sonrası olmalı (Europe/Istanbul).
function parseFutureDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new KivirikError("Tarih YYYY-AA-GG biçiminde olmalı");
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new KivirikError("Geçersiz tarih");
  }
  if (value < istanbulToday()) {
    throw new KivirikError("Tarih geçmişte olamaz");
  }
  return value;
}

function parseText(value) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > 200) {
    throw new KivirikError("Metin 1-200 karakter olmalı");
  }
  return text;
}

async function updateSubscription(client, subscriptionId, values) {
  const columns = Object.keys(values);
  const sets = columns.map((column, index) => `${column} = $${index + 2}`);
  await client.query(
    `update user_subscriptions set ${sets.join(", ")} where id = $1`,
    [subscriptionId, ...columns.map((column) => values[column])]
  );
}

// Cevabın uygulamadaki etkisi; kaydedilecek value'yu döner.
async function applyEffect(client, { userId, question, answer, value, sub }) {
  switch (question.key) {
    case "billing_day": {
      if (answer === "unknown") return null;
      const billing = parseBillingFields(value);
      if (billing.error || billing.billing_date == null) {
        throw new KivirikError(billing.error || "Ödeme günü eksik");
      }
      const yearly = sub.billing_cycle === "yearly";
      if (yearly && billing.billing_month == null) {
        throw new KivirikError("Yıllık planda ay da seçilmeli");
      }
      await updateSubscription(client, sub.id, {
        billing_date: billing.billing_date,
        billing_month: yearly ? billing.billing_month : null,
      });
      return JSON.stringify({ day: billing.billing_date, month: yearly ? billing.billing_month : null });
    }
    case "payment_channel":
      await updateSubscription(client, sub.id, { payment_channel: answer });
      return null;
    case "usage_frequency":
      await updateSubscription(client, sub.id, { usage_frequency: answer });
      return null;
    case "reminder_days_before":
      await updateSettings(userId, { reminder_days_before: Number(answer) }, client);
      return null;
    case "price_confirm": {
      if (answer === "yes") {
        // Katalog fiyatı doğru: kullanıcıya özel tutar varsa kalkar.
        await updateSubscription(client, sub.id, { custom_price: null, custom_currency: null });
        return null;
      }
      const amount = parseAmount(value);
      await updateSubscription(client, sub.id, { custom_price: amount, custom_currency: "TRY" });
      await client.query(
        "insert into price_reports (catalog_id, user_id, reported_price) values ($1, $2, $3)",
        [sub.catalog_id, userId, amount]
      );
      return String(amount);
    }
    case "share_count":
      await updateSubscription(client, sub.id, { share_count: Number(answer) });
      return null;
    case "is_trial": {
      if (answer === "no") {
        await updateSubscription(client, sub.id, { is_trial: false, trial_ends_at: null });
        return null;
      }
      const date = parseFutureDate(value);
      await updateSubscription(client, sub.id, { is_trial: true, trial_ends_at: date });
      return date;
    }
    case "planned_end": {
      if (answer === "no") {
        await updateSubscription(client, sub.id, { planned_end_at: null });
        return null;
      }
      const date = parseFutureDate(value);
      await updateSubscription(client, sub.id, { planned_end_at: date });
      return date;
    }
    case "reason": {
      const text = parseText(value);
      await updateSubscription(client, sub.id, { reason: text });
      return text;
    }
    case "is_student":
      await updateSettings(userId, { is_student: answer === "yes" }, client);
      return null;
    case "monthly_budget": {
      if (answer === "none") return null;
      const amount = parseAmount(value);
      await updateSettings(userId, { monthly_budget: amount }, client);
      return String(amount);
    }
    case "store_check":
      return null;
    default:
      throw new KivirikError("Bilinmeyen soru");
  }
}

// Cevabı tek transaction'da uygular ve kaydeder. Detay ekranındaki
// düzenlemeler de aynı yoldan geçer (cevap kaydı güncellenir).
async function answerQuestion(userId, body, withTransaction) {
  const question = QUESTIONS_BY_KEY.get(body?.key);
  if (!question) {
    throw new KivirikError("Bilinmeyen soru");
  }

  const answer = body.answer == null ? "" : String(body.answer);
  if (!Object.prototype.hasOwnProperty.call(question.answers, answer)) {
    throw new KivirikError("Geçersiz cevap");
  }

  const period = question.period === "once" ? "once" : String(body.period || "");
  if (!period) {
    throw new KivirikError("period zorunludur");
  }

  const subscriptionId = question.scope === "subscription" ? body.user_subscription_id : null;
  if (question.scope === "subscription" && !subscriptionId) {
    throw new KivirikError("user_subscription_id zorunludur");
  }

  await withTransaction(async (client) => {
    let sub = null;
    if (subscriptionId) {
      const { rows } = await client.query(
        `select us.id, us.catalog_id, sc.billing_cycle
         from user_subscriptions us
         join subscriptions_catalog sc on sc.id = us.catalog_id
         where us.id = $1 and us.user_id = $2 and sc.managed_by is null
         for update of us`,
        [subscriptionId, userId]
      );
      sub = rows[0];
      if (!sub) {
        throw new KivirikError("Abonelik bulunamadı", 404);
      }
    }

    const value = await applyEffect(client, { userId, question, answer, value: body.value, sub });

    await client.query(
      `insert into kivirik_answers (user_id, user_subscription_id, question_key, period, answer, value)
       values ($1, $2, $3, $4, $5, $6)
       on conflict on constraint kivirik_answers_unique
       do update set answer = excluded.answer, value = excluded.value, created_at = now()`,
      [userId, subscriptionId, question.key, period, answer, value]
    );
  });
}

// "Geç" (7 gün sonra tekrar) ya da "Bunu bir daha sorma".
async function dismissQuestion(userId, body) {
  const question = QUESTIONS_BY_KEY.get(body?.key);
  if (!question) {
    throw new KivirikError("Bilinmeyen soru");
  }
  if (body.mode !== "later" && body.mode !== "never") {
    throw new KivirikError("mode later ya da never olmalı");
  }

  const subscriptionId = question.scope === "subscription" ? body.user_subscription_id : null;
  if (question.scope === "subscription") {
    const { rows } = await db.query(
      "select 1 from user_subscriptions where id = $1 and user_id = $2",
      [subscriptionId, userId]
    );
    if (rows.length === 0) {
      throw new KivirikError("Abonelik bulunamadı", 404);
    }
  }

  await db.query(
    `insert into kivirik_dismissals (user_id, question_key, user_subscription_id, until)
     values ($1, $2, $3, case when $4 then now() + interval '${LATER_DAYS} days' else null end)
     on conflict on constraint kivirik_dismissals_unique
     do update set until = excluded.until, created_at = now()`,
    [userId, question.key, subscriptionId, body.mode === "later"]
  );
}

module.exports = {
  KivirikError,
  answerQuestion,
  dismissQuestion,
  getPendingQuestions,
  getSettings,
  istanbulToday,
  updateSettings,
};

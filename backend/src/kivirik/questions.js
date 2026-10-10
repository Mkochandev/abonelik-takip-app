// Kıvırık soruları: hangi sorunun ne zaman sorulacağı (backend tarafı).
// Soru metinleri ve seçenek etiketleri mobilde (mobile/src/config/
// kivirikQuestions.js); burada yalnızca anahtar, kapsam, öncelik, periyot
// tipi, koşul ve geçerli cevaplar durur.
//
// scope: "subscription" (abonelik başına) | "user" (kullanıcı başına)
// period: "once" | "monthly" | "quarterly" | "event"
// priority: 1 = ilk sorulur. Aynı öncelikte pahalı abonelik önce.
//
// when(ctx) -> boolean (tek seferlik sorular)
//   abonelik sorularında ctx = { sub, settings, now, todayIso }
//   (sub.latest_price_change: aboneliğin eklenmesinden sonraki son katalog
//   fiyat değişikliği { id, price, new_price, changed_at } ya da null)
//   kullanıcı sorularında ctx = { subs, settings, now, todayIso }
// pendingPeriod(ctx) -> dönem anahtarı | null (periyodik/tetiklemeli
//   sorular; o dönem cevaplanmadıysa sorulur). periodPattern: istemcinin
//   gönderdiği dönemin biçimi.
// target: "cancelled" ise soru iptal edilmiş aboneliklerde sorulur
//   (varsayılan: iptal edilmemişler).
// answers: geçerli cevap anahtarları; value gerektirenler valueType ile.

const {
  addDaysIso,
  daysBetweenIso,
  firstBillingDayAfter,
  istanbulDay,
  monthKey,
  quarterKey,
} = require("./dates");

const DAY_MS = 24 * 60 * 60 * 1000;

// cancel_verify, iptalden sonraki ilk ödeme gününden bu kadar gün sonrasına
// kadar sorulur; uygulama aylarca açılmadıysa "bu ay" sorusu anlamsızlaşır.
const CANCEL_VERIFY_WINDOW_DAYS = 45;

// Deneme bitişine bu kadar günden az kala sorulur.
const TRIAL_ENDING_DAYS = 3;

// Kullanım ve değer soruları yeni eklenen aboneliklerde hemen sorulmaz.
const USAGE_CHECK_MIN_AGE_DAYS = 14;
const VALUE_CHECK_MIN_AGE_DAYS = 30;
// "Bu ay açtın mı?" ayın ilk yarısında anlamsız; ayın bu gününden sonra sorulur.
const USAGE_CHECK_FROM_DAY = 15;

// Kullanımı seyrek olanlara her ay, diğerlerine 3 ayda bir sorulur.
const MONTHLY_USAGE_FREQUENCIES = ["Ayda birkaç kez", "Neredeyse hiç"];

const round2 = (value) => Math.round(value * 100) / 100;

const USAGE_FREQUENCIES = ["Her gün", "Haftada birkaç kez", "Ayda birkaç kez", "Neredeyse hiç"];
const PAYMENT_CHANNELS = ["app_store", "google_play", "web_card", "operator", "someone_else"];

function hasBillingDay(sub) {
  if (!sub.billing_date) return false;
  return sub.billing_cycle === "yearly" ? Boolean(sub.billing_month) : true;
}

const isSomeoneElse = (sub) => sub.payment_channel === "someone_else";

// İptalden sonraki ilk eski ödeme günü geçtiyse o günün ayı ('YYYY-MM').
function cancelVerifyPeriod({ sub, todayIso }) {
  if (!sub.cancelled_at || isSomeoneElse(sub) || !hasBillingDay(sub)) return null;
  const due = firstBillingDayAfter(sub, istanbulDay(new Date(sub.cancelled_at)));
  if (!due || todayIso <= due || todayIso > addDaysIso(due, CANCEL_VERIFY_WINDOW_DAYS)) {
    return null;
  }
  return due.slice(0, 7);
}

function ageDays(sub, todayIso) {
  return daysBetweenIso(istanbulDay(new Date(sub.started_at)), todayIso);
}

function trialEndingPeriod({ sub, todayIso }) {
  if (!sub.is_trial || !sub.trial_ends_at) return null;
  const daysLeft = daysBetweenIso(todayIso, sub.trial_ends_at);
  return daysLeft >= 0 && daysLeft < TRIAL_ENDING_DAYS ? `trial:${sub.trial_ends_at}` : null;
}

// Eklemeden sonraki son katalog fiyat değişikliği artışsa. Fiyat uyarısını
// kapatanlara ve başkasının ödediği aboneliklerde sorulmaz.
function priceIncreasePeriod({ sub }) {
  const change = sub.latest_price_change;
  if (!change || sub.price_alert_enabled === false || isSomeoneElse(sub)) return null;
  return Number(change.new_price) > Number(change.price) ? `price:${change.id}` : null;
}

function priceIncreaseParams({ sub, todayIso }) {
  const change = sub.latest_price_change;
  const diff = round2(Number(change.new_price) - Number(change.price));
  const yearly = sub.billing_cycle === "yearly";
  return {
    old_price: Number(change.price),
    new_price: Number(change.new_price),
    price_currency: sub.catalog_currency,
    monthly_diff: round2(yearly ? diff / 12 : diff),
    yearly_diff: round2(yearly ? diff : diff * 12),
    changed_days_ago: daysBetweenIso(istanbulDay(new Date(change.changed_at)), todayIso),
  };
}

function monthlyUsagePeriod({ sub, todayIso }) {
  if (ageDays(sub, todayIso) < USAGE_CHECK_MIN_AGE_DAYS) return null;
  if (Number(todayIso.slice(8, 10)) < USAGE_CHECK_FROM_DAY) return null;
  return MONTHLY_USAGE_FREQUENCIES.includes(sub.usage_frequency) ? monthKey(todayIso) : quarterKey(todayIso);
}

function valueCheckPeriod({ sub, todayIso }) {
  if (isSomeoneElse(sub) || ageDays(sub, todayIso) < VALUE_CHECK_MIN_AGE_DAYS) return null;
  return quarterKey(todayIso);
}

const QUESTIONS = [
  {
    key: "trial_ending",
    scope: "subscription",
    period: "event",
    priority: 1,
    pendingPeriod: trialEndingPeriod,
    periodPattern: /^trial:\d{4}-\d{2}-\d{2}$/,
    params: ({ sub, todayIso }) => ({
      trial_ends_at: sub.trial_ends_at,
      days_left: daysBetweenIso(todayIso, sub.trial_ends_at),
    }),
    // "Yarın tekrar hatırlat" cevap değil, 1 günlük ertelemedir (dismiss: tomorrow).
    answers: { continue: null, cancel: null },
  },
  {
    key: "cancel_verify",
    scope: "subscription",
    target: "cancelled",
    period: "event",
    priority: 1,
    pendingPeriod: cancelVerifyPeriod,
    periodPattern: /^\d{4}-\d{2}$/,
    params: ({ sub }) => ({
      charge_date: firstBillingDayAfter(sub, istanbulDay(new Date(sub.cancelled_at))),
    }),
    answers: { no: null, yes: null },
  },
  {
    key: "price_increase",
    scope: "subscription",
    period: "event",
    priority: 2,
    pendingPeriod: priceIncreasePeriod,
    periodPattern: /^price:[0-9a-f-]{36}$/,
    params: priceIncreaseParams,
    answers: { keep: null, cheaper: null, leave: null },
  },
  {
    key: "billing_day",
    scope: "subscription",
    period: "once",
    priority: 3,
    when: ({ sub }) => !hasBillingDay(sub) && !isSomeoneElse(sub),
    answers: { set: "billing", unknown: null },
  },
  {
    key: "payment_channel",
    scope: "subscription",
    period: "once",
    priority: 3,
    when: ({ sub }) => !sub.payment_channel,
    answers: Object.fromEntries(PAYMENT_CHANNELS.map((channel) => [channel, null])),
  },
  {
    key: "usage_frequency",
    scope: "subscription",
    period: "once",
    priority: 3,
    when: ({ sub }) => !sub.usage_frequency,
    answers: Object.fromEntries(USAGE_FREQUENCIES.map((value) => [value, null])),
  },
  {
    key: "reminder_days_before",
    scope: "user",
    period: "once",
    priority: 3,
    when: ({ settings }) => settings.reminder_days_before == null,
    answers: { 0: null, 1: null, 3: null, 7: null },
  },
  {
    key: "price_confirm",
    scope: "subscription",
    period: "once",
    priority: 4,
    // Henüz sorulmadıysa (cevap kaydı motor tarafından kontrol edilir).
    when: ({ sub }) => sub.custom_price == null && !isSomeoneElse(sub),
    answers: { yes: null, no: "amount" },
  },
  {
    key: "share_count",
    scope: "subscription",
    period: "once",
    priority: 4,
    when: ({ sub }) => sub.share_count == null && !isSomeoneElse(sub),
    answers: { 1: null, 2: null, 3: null, 5: null },
  },
  {
    key: "is_trial",
    scope: "subscription",
    period: "once",
    priority: 4,
    when: ({ sub, now }) =>
      sub.is_trial == null && now - new Date(sub.started_at).getTime() <= 30 * DAY_MS,
    answers: { no: null, yes: "date" },
  },
  {
    key: "planned_end",
    scope: "subscription",
    period: "once",
    priority: 4,
    when: ({ sub }) => sub.planned_end_at == null,
    answers: { no: null, yes: "date" },
  },
  {
    key: "reason",
    scope: "subscription",
    period: "once",
    priority: 4,
    // Eklerken atlandıysa alan boş kalır.
    when: ({ sub }) => !sub.reason,
    answers: { set: "text" },
  },
  {
    key: "is_student",
    scope: "user",
    period: "once",
    priority: 4,
    when: ({ settings }) => settings.is_student == null,
    answers: { yes: null, no: null },
  },
  {
    key: "monthly_budget",
    scope: "user",
    period: "once",
    priority: 4,
    when: ({ settings }) => settings.monthly_budget == null,
    answers: { none: null, set: "amount" },
  },
  {
    key: "store_check",
    scope: "user",
    period: "once",
    priority: 4,
    when: ({ subs }) => subs.length > 0,
    answers: { open: null, later: null },
  },
  {
    key: "monthly_usage_check",
    scope: "subscription",
    period: "monthly",
    priority: 5,
    pendingPeriod: monthlyUsagePeriod,
    periodPattern: /^\d{4}-(\d{2}|Q[1-4])$/,
    answers: { often: null, few: null, never: null },
  },
  {
    key: "value_check",
    scope: "subscription",
    period: "quarterly",
    priority: 6,
    pendingPeriod: valueCheckPeriod,
    periodPattern: /^\d{4}-Q[1-4]$/,
    answers: { yes: null, meh: null, no: null },
  },
];

const QUESTIONS_BY_KEY = new Map(QUESTIONS.map((question) => [question.key, question]));

module.exports = {
  QUESTIONS,
  QUESTIONS_BY_KEY,
  USAGE_FREQUENCIES,
  PAYMENT_CHANNELS,
  cancelVerifyPeriod,
  hasBillingDay,
  monthlyUsagePeriod,
  priceIncreasePeriod,
  trialEndingPeriod,
  valueCheckPeriod,
};

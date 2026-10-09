// Kıvırık soruları: hangi sorunun ne zaman sorulacağı (backend tarafı).
// Soru metinleri ve seçenek etiketleri mobilde (mobile/src/config/
// kivirikQuestions.js); burada yalnızca anahtar, kapsam, öncelik, periyot
// tipi, koşul ve geçerli cevaplar durur.
//
// scope: "subscription" (abonelik başına) | "user" (kullanıcı başına)
// period: "once" | "monthly" | "quarterly" | "event"
// priority: 1 = ilk sorulur. Aynı öncelikte pahalı abonelik önce.
//
// when(ctx) -> boolean
//   abonelik sorularında ctx = { sub, settings, now, todayIso }
//   kullanıcı sorularında ctx = { subs, settings, now, todayIso }
// answers: geçerli cevap anahtarları; value gerektirenler valueType ile.

const DAY_MS = 24 * 60 * 60 * 1000;

const USAGE_FREQUENCIES = ["Her gün", "Haftada birkaç kez", "Ayda birkaç kez", "Neredeyse hiç"];
const PAYMENT_CHANNELS = ["app_store", "google_play", "web_card", "operator", "someone_else"];

function hasBillingDay(sub) {
  if (!sub.billing_date) return false;
  return sub.billing_cycle === "yearly" ? Boolean(sub.billing_month) : true;
}

const isSomeoneElse = (sub) => sub.payment_channel === "someone_else";

const QUESTIONS = [
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
];

const QUESTIONS_BY_KEY = new Map(QUESTIONS.map((question) => [question.key, question]));

module.exports = { QUESTIONS, QUESTIONS_BY_KEY, USAGE_FREQUENCIES, PAYMENT_CHANNELS, hasBillingDay };

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
//   kullanıcı sorularında ctx = { subs, settings, now, todayIso }
// pendingPeriod(ctx) -> dönem anahtarı | null (periyodik/tetiklemeli
//   sorular; o dönem cevaplanmadıysa sorulur). periodPattern: istemcinin
//   gönderdiği dönemin biçimi.
// target: "cancelled" ise soru iptal edilmiş aboneliklerde sorulur
//   (varsayılan: iptal edilmemişler).
// answers: geçerli cevap anahtarları; value gerektirenler valueType ile.

const { addDaysIso, firstBillingDayAfter, istanbulDay } = require("./dates");

const DAY_MS = 24 * 60 * 60 * 1000;

// cancel_verify, iptalden sonraki ilk ödeme gününden bu kadar gün sonrasına
// kadar sorulur; uygulama aylarca açılmadıysa "bu ay" sorusu anlamsızlaşır.
const CANCEL_VERIFY_WINDOW_DAYS = 45;

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

const QUESTIONS = [
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

module.exports = {
  QUESTIONS,
  QUESTIONS_BY_KEY,
  USAGE_FREQUENCIES,
  PAYMENT_CHANNELS,
  cancelVerifyPeriod,
  hasBillingDay,
};

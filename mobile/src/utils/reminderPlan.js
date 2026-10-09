import { getNextBillingDate, hasBillingDay } from "./billing";
import { formatTRYText, formatUSD } from "./price";

// Yerel ödeme hatırlatmalarının planı (saf hesap; planlama services/reminders'ta).

export const REMINDER_HOUR = 10;

// Tek abonelik için ileriye dönük kaç ödeme planlanır. rescheduleAll her
// açılışta yeniden kurduğu için uygulama uzun süre açılmasa bile birkaç
// ödeme önceden hazır kalır.
const OCCURRENCES_PER_SUBSCRIPTION = 6;

const DAY_MS = 24 * 60 * 60 * 1000;

function whenLabel(daysBefore) {
  if (daysBefore === 0) return "Bugün";
  if (daysBefore === 1) return "Yarın";
  if (daysBefore === 7) return "1 hafta sonra";
  return `${daysBefore} gün sonra`;
}

// Deneme bitişinden kaç gün önce hatırlatılır.
const TRIAL_NOTICE_DAYS = 2;

// 'YYYY-MM-DD' -> o günün REMINDER_HOUR'u (yerel saat), daysBefore gün önce.
function isoDayTrigger(iso, daysBefore = 0) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day - daysBefore, REMINDER_HOUR, 0, 0, 0);
}

// Ödeme dışı hatırlatmalar: deneme bitişi (2 gün önce) ve planlı bırakma
// günü. Servis adına ek getirilmez.
function lifecycleReminders(sub, now) {
  const reminders = [];
  if (sub.cancelled_at || sub.reminders_disabled) {
    return reminders;
  }
  if (sub.is_trial && sub.trial_ends_at) {
    const triggerDate = isoDayTrigger(sub.trial_ends_at, TRIAL_NOTICE_DAYS);
    if (triggerDate > now) {
      reminders.push({
        type: "trial",
        subscriptionId: sub.id,
        triggerDate,
        body: `${sub.app_name} denemen ${TRIAL_NOTICE_DAYS} gün sonra bitiyor.`,
      });
    }
  }
  if (sub.planned_end_at) {
    const triggerDate = isoDayTrigger(sub.planned_end_at);
    if (triggerDate > now) {
      reminders.push({
        type: "planned_end",
        subscriptionId: sub.id,
        triggerDate,
        body: `Bugün ${sub.app_name} aboneliğini bırakmayı planlamıştın. İptal ettin mi?`,
      });
    }
  }
  return reminders;
}

// "229,99 TL" ya da USD'de "$20,00 (≈950,00 TL)"
function priceLabel(sub) {
  if (sub.currency === "USD") {
    return sub.current_price_try != null
      ? `${formatUSD(sub.current_price)} (≈${formatTRYText(sub.current_price_try)})`
      : formatUSD(sub.current_price);
  }
  return formatTRYText(sub.current_price);
}

// Uygulama adına ek getirilmez: "Yarın Netflix ödemen var: 229,99 TL".
export function reminderBody(sub, daysBefore) {
  return `${whenLabel(daysBefore)} ${sub.app_name} ödemen var: ${priceLabel(sub)}`;
}

// Ödemeden daysBefore gün önce saat REMINDER_HOUR'da.
function triggerFor(paymentDate, daysBefore) {
  const trigger = new Date(paymentDate);
  trigger.setDate(trigger.getDate() - daysBefore);
  trigger.setHours(REMINDER_HOUR, 0, 0, 0);
  return trigger;
}

// [{ type, subscriptionId, triggerDate, body }] — tetik zamanına göre sıralı,
// en fazla limit kadar (iOS'ta bekleyen bildirim sınırı 64; yalnızca en yakın
// olanlar planlanır). type: payment | trial | planned_end. Ödeme hatırlatması
// başkasının ödediği, iptal edilmiş ve reminders_disabled kayıtlarda yok.
export function buildReminderPlan(subscriptions, { daysBefore, now = new Date(), limit = 60 }) {
  const reminders = [];

  for (const sub of subscriptions) {
    reminders.push(...lifecycleReminders(sub, now));

    if (
      !hasBillingDay(sub) ||
      sub.reminders_disabled ||
      sub.cancelled_at ||
      sub.payment_channel === "someone_else"
    ) {
      continue;
    }

    let paymentDate = getNextBillingDate(sub, now);
    let count = 0;

    while (paymentDate && count < OCCURRENCES_PER_SUBSCRIPTION) {
      const triggerDate = triggerFor(paymentDate, daysBefore);
      if (triggerDate > now) {
        reminders.push({
          type: "payment",
          subscriptionId: sub.id,
          paymentDate,
          triggerDate,
          body: reminderBody(sub, daysBefore),
        });
        count += 1;
      }
      paymentDate = getNextBillingDate(sub, new Date(paymentDate.getTime() + DAY_MS));
    }
  }

  return reminders.sort((a, b) => a.triggerDate - b.triggerDate).slice(0, limit);
}

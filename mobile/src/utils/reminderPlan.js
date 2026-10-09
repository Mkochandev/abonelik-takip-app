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
  return `${daysBefore} gün sonra`;
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

// [{ subscriptionId, paymentDate, triggerDate, body }] — tetik zamanına göre
// sıralı, en fazla limit kadar (iOS'ta bekleyen bildirim sınırı 64; yalnızca
// en yakın ödemeler planlanır). reminders_disabled işaretli kayıtlar atlanır.
export function buildReminderPlan(subscriptions, { daysBefore, now = new Date(), limit = 60 }) {
  const reminders = [];

  for (const sub of subscriptions) {
    if (!hasBillingDay(sub) || sub.reminders_disabled) {
      continue;
    }

    let paymentDate = getNextBillingDate(sub, now);
    let count = 0;

    while (paymentDate && count < OCCURRENCES_PER_SUBSCRIPTION) {
      const triggerDate = triggerFor(paymentDate, daysBefore);
      if (triggerDate > now) {
        reminders.push({
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

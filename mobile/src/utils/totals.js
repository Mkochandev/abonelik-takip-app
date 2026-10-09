import { monthlyPriceTry } from "./catalog";

// Aboneliğin toplamlara (aylık toplam, kategoriler, yaklaşan ödemeler,
// bütçe) katılıp katılmadığı: başkasının ödediği, iptal edilmiş ya da
// Premium'u bitmiş erişte kaydı (reminders_disabled) katılmaz.
export function isCountedInTotals(sub) {
  return sub.payment_channel !== "someone_else" && !sub.cancelled_at && !sub.reminders_disabled;
}

export function sumCountedMonthlyTry(subscriptions) {
  return subscriptions
    .filter(isCountedInTotals)
    .reduce((sum, sub) => sum + monthlyPriceTry(sub), 0);
}

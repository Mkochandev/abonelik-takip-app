// Ödeme günü yardımcıları. Abonelik satırında billing_date ayın günü
// (1–31), billing_month yıllık planlarda ay (1–12); plan dönemi katalog
// kaydının billing_cycle alanından gelir ("monthly" | "yearly").

export const MONTH_NAMES = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

const DAY_MS = 24 * 60 * 60 * 1000;

export function isYearly(item) {
  return item?.billing_cycle === "yearly";
}

// Bir ayda o ayın en fazla kaç günü olabileceği (Şubat için 29; artık yıl
// olmayan yıllarda hesapta 28'e indirilir).
export function maxDayOfMonth(month) {
  return new Date(2024, month, 0).getDate();
}

// Yıllık planda ay da girilmiş olmalı.
export function hasBillingDay(item) {
  if (!item?.billing_date) {
    return false;
  }
  return isYearly(item) ? Boolean(item.billing_month) : true;
}

// Ayın 29–31'i olmayan aylarda ayın son günü kabul edilir.
function clampedDate(year, monthIndex, day) {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(day, daysInMonth));
}

// Bugün dahil bir sonraki ödeme tarihi (gün başı); gün yoksa null.
export function getNextBillingDate(item, from = new Date()) {
  if (!hasBillingDay(item)) {
    return null;
  }

  const today = new Date(from);
  today.setHours(0, 0, 0, 0);
  const day = item.billing_date;

  if (isYearly(item)) {
    const monthIndex = item.billing_month - 1;
    const thisYear = clampedDate(today.getFullYear(), monthIndex, day);
    return thisYear >= today ? thisYear : clampedDate(today.getFullYear() + 1, monthIndex, day);
  }

  const thisMonth = clampedDate(today.getFullYear(), today.getMonth(), day);
  if (thisMonth >= today) {
    return thisMonth;
  }
  // new Date(yıl, 12, ...) bir sonraki yılın Ocak ayına taşar.
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return clampedDate(nextMonth.getFullYear(), nextMonth.getMonth(), day);
}

// { daysLeft, dateLabel, month } ya da gün yoksa null. Date nesnesi
// dönmez: sonuç abonelik satırına karıştırılıp navigasyon parametresi olarak
// gönderiliyor (serileştirilebilir kalmalı).
export function getNextBillingInfo(item, from = new Date()) {
  const date = getNextBillingDate(item, from);
  if (!date) {
    return null;
  }

  const today = new Date(from);
  today.setHours(0, 0, 0, 0);

  return {
    daysLeft: Math.round((date - today) / DAY_MS),
    dateLabel: date.toLocaleDateString("tr-TR", { day: "numeric", month: "long" }),
    month: date.getMonth(),
  };
}

// Detay ekranı için: "Her ayın 15. günü", "Her yıl 3 Mart"; gün yoksa null.
// Sayıya ek getirilmez (okunuşa göre ek seçmek yerine eksiz kalıp).
export function formatBillingDay(item) {
  if (!hasBillingDay(item)) {
    return null;
  }
  if (isYearly(item)) {
    return `Her yıl ${item.billing_date} ${MONTH_NAMES[item.billing_month - 1]}`;
  }
  return `Her ayın ${item.billing_date}. günü`;
}

// Fiyatın yanındaki dönem etiketi.
export function periodLabel(item) {
  return isYearly(item) ? "/ yıl" : "/ ay";
}

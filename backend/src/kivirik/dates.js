// Kıvırık soruları için gün hesapları. Günler 'YYYY-MM-DD' metni olarak
// taşınır (Europe/Istanbul), saat dilimi kayması olmasın diye Date
// aritmetiği UTC üzerinden yapılır.

const TIME_ZONE = "Europe/Istanbul";
const DAY_MS = 24 * 60 * 60 * 1000;

function pad(n) {
  return String(n).padStart(2, "0");
}

// Verilen anın Europe/Istanbul'daki günü: 'YYYY-MM-DD'.
function istanbulDay(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(date);
}

function addDaysIso(iso, days) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day) + days * DAY_MS).toISOString().slice(0, 10);
}

// Ayın 29–31'i olmayan aylarda ayın son günü (mobildeki utils/billing ile aynı).
function clampedIso(year, month, day) {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${pad(month)}-${pad(Math.min(day, last))}`;
}

// afterIso'dan sonraki (o gün hariç) ilk ödeme günü; gün yoksa null.
function firstBillingDayAfter(sub, afterIso) {
  if (!sub.billing_date) return null;
  const [year, month] = afterIso.split("-").map(Number);

  if (sub.billing_cycle === "yearly") {
    if (!sub.billing_month) return null;
    for (const candidateYear of [year, year + 1]) {
      const candidate = clampedIso(candidateYear, sub.billing_month, sub.billing_date);
      if (candidate > afterIso) return candidate;
    }
    return null;
  }

  for (const offset of [0, 1]) {
    const monthIndex = month - 1 + offset;
    const candidate = clampedIso(year + Math.floor(monthIndex / 12), (monthIndex % 12) + 1, sub.billing_date);
    if (candidate > afterIso) return candidate;
  }
  return null;
}

module.exports = { addDaysIso, firstBillingDayAfter, istanbulDay };

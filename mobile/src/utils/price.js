// Fiyatları tr-TR biçiminde gösterir: TL "289,99 ₺", USD "$20,00". USD
// abonelikler için asıl tutar ("$20,00") ve güncel kurla TL karşılığı
// ("≈950,00 ₺") ayrı alanlar olarak döner, böylece ekranlar ikisini farklı
// stillerle basabilir.

const amountFormatter = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatTRY(amount) {
  return `${amountFormatter.format(Number(amount))} ₺`;
}

// Bildirim metinleri için: "229,99 TL" (₺ simgesi bildirimlerde düz metin).
export function formatTRYText(amount) {
  return `${amountFormatter.format(Number(amount))} TL`;
}

export function formatUSD(amount) {
  return `$${amountFormatter.format(Number(amount))}`;
}

// Tek bir tutarı kendi para birimiyle biçimlendirir (örn. fiyat geçmişi).
export function formatAmount(amount, currency) {
  return currency === "USD" ? formatUSD(amount) : formatTRY(amount);
}

export function formatSubscriptionPrice(item) {
  if (item.currency === "USD") {
    const tryValue = item.current_price_try;
    return {
      primary: formatUSD(item.current_price),
      secondary: tryValue != null ? `≈${formatTRY(tryValue)}` : null,
    };
  }

  return {
    primary: formatTRY(item.current_price),
    secondary: null,
  };
}

// TL fiyatları tr-TR biçiminde ("289,99 ₺") gösterir. USD abonelikler için
// asıl tutar ("$20") ve güncel kurla TL karşılığı ("≈950,00 ₺") ayrı alanlar
// olarak döner, böylece ekranlar ikisini farklı stillerle basabilir.

const tryFormatter = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatTRY(amount) {
  return `${tryFormatter.format(Number(amount))} ₺`;
}

export function formatSubscriptionPrice(item) {
  if (item.currency === "USD") {
    const tryValue = Number(item.current_price_try ?? item.current_price);
    return {
      primary: `$${item.current_price}`,
      secondary: `≈${formatTRY(tryValue)}`,
    };
  }

  return {
    primary: formatTRY(item.current_price),
    secondary: null,
  };
}

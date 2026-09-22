// USD abonelikler için orijinal fiyatın yanında güncel TRY karşılığını da
// gösterir (örn. "$20 (≈940 ₺)"). Diğer para birimleri olduğu gibi kalır.

export function formatSubscriptionPrice(item) {
  if (item.currency === "USD") {
    const tryValue = Number(item.current_price_try ?? item.current_price);
    return `$${item.current_price} (≈${tryValue.toFixed(0)} ₺)`;
  }

  return `${item.current_price} ${item.currency}`;
}

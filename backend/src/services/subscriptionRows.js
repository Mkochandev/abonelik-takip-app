// Kullanıcı aboneliği satırlarının ortak seçimi ve doğrulaması
// (routes/subscriptions.js ve Kıvırık soruları aynı biçimi kullanır).

// Kullanıcıya özel fiyat (custom_price: erişte Premium'da App Store fiyatı ya
// da kullanıcının "farklı ödüyorum" dediği tutar) doluysa katalog fiyatının
// yerine geçer; para birimi de onunla gelir. Tarih alanları gün olarak
// ('YYYY-MM-DD') döner ki saat dilimi kaymasın.
const SUBSCRIPTION_WITH_CATALOG_COLUMNS = `us.id, us.started_at, us.reason, us.usage_frequency,
  us.price_alert_enabled, us.billing_date, us.billing_month, sc.id as catalog_id, sc.app_name,
  sc.plan_name, coalesce(us.custom_price, sc.current_price) as current_price,
  coalesce(us.custom_currency, sc.currency) as currency, us.custom_price,
  sc.current_price as catalog_price, sc.currency as catalog_currency, sc.billing_cycle,
  sc.category, sc.domain, sc.logo_url, sc.cancel_url, sc.managed_by, us.payment_channel,
  us.share_count,
  us.is_trial, to_char(us.trial_ends_at, 'YYYY-MM-DD') as trial_ends_at,
  to_char(us.planned_end_at, 'YYYY-MM-DD') as planned_end_at, us.cancelled_at`;

function isIntInRange(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

// Ödeme günü (1–31) ve yıllık planlar için ayı (1–12) doğrular. Boş değerler
// null olur; ay, gün olmadan kabul edilmez.
function parseBillingFields(source) {
  const day = source?.billing_date ?? null;
  const month = source?.billing_month ?? null;

  if (day !== null && !isIntInRange(day, 1, 31)) {
    return { error: "billing_date 1 ile 31 arasında bir tam sayı olmalı" };
  }

  if (month !== null && (!isIntInRange(month, 1, 12) || day === null)) {
    return { error: "billing_month 1 ile 12 arasında olmalı ve billing_date ile gönderilmeli" };
  }

  return { billing_date: day, billing_month: month };
}

// USD fiyatların güncel kurla TL karşılığı.
function withPriceTry(row, usdToTryRate) {
  return {
    ...row,
    current_price_try:
      row.currency === "USD"
        ? Number((Number(row.current_price) * usdToTryRate).toFixed(2))
        : Number(row.current_price),
  };
}

// Aylık karşılık (TL): yıllık planlar 12'ye bölünür (mobildeki
// monthlyPriceTry ile aynı).
function monthlyPriceTry(row) {
  const price = Number(row.current_price_try ?? row.current_price ?? 0);
  return row.billing_cycle === "yearly" ? price / 12 : price;
}

module.exports = {
  SUBSCRIPTION_WITH_CATALOG_COLUMNS,
  isIntInRange,
  monthlyPriceTry,
  parseBillingFields,
  withPriceTry,
};

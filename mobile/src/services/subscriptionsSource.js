import * as api from "../api/client";
import { getGuestSubscriptions } from "../storage/guestSubscriptions";
import { indexCatalogPlans } from "../utils/catalog";

// Misafir listesi yalnızca catalog_id ve ödeme gününü tutar; ad, fiyat, logo
// ve kategori her seferinde güncel katalogdan eklenir. Katalogdan kaldırılmış
// kayıtlar gösterilmez.
export async function loadGuestSubscriptions() {
  const [items, data] = await Promise.all([getGuestSubscriptions(), api.getCatalog()]);
  const plans = indexCatalogPlans(data.catalog);

  return items
    .filter((item) => plans.has(item.catalog_id))
    .map((item) => ({
      ...plans.get(item.catalog_id),
      id: item.catalog_id,
      added_at: item.added_at,
      billing_date: item.billing_date ?? null,
      billing_month: item.billing_month ?? null,
      isGuest: true,
    }));
}

// Uygulamanın yönettiği kayıt (erişte Premium) ve Premium aktif değil mi?
export function isManagedInactive(sub) {
  return Boolean(sub.managed_by) && !sub.managed_active;
}

// Oturum varsa hesaptaki, yoksa bu cihazdaki abonelikler (katalog bilgisiyle).
// Premium'u bitmiş erişte kaydı için hatırlatma planlanmaz.
export async function loadSubscriptions(token) {
  if (!token) {
    return loadGuestSubscriptions();
  }
  const { subscriptions } = await api.getUserSubscriptions(token);
  return subscriptions.map((sub) =>
    isManagedInactive(sub) ? { ...sub, reminders_disabled: true } : sub
  );
}

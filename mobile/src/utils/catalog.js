// /api/catalog yanıtı (app_name'e göre gruplu) üzerinde ortak yardımcılar.

function planPriceTry(plan) {
  return Number(plan.current_price_try ?? plan.current_price);
}

// Katalog grubunu, ekranların abonelik satırı gibi kullanabileceği düz bir
// plan kaydına çevirir (logo alanları planda yoksa grubunkine düşer).
export function toCatalogEntry(group, plan) {
  return {
    ...plan,
    catalog_id: plan.id,
    app_name: group.app_name,
    domain: plan.domain ?? group.domain,
    logo_url: plan.logo_url ?? group.logo_url,
  };
}

// catalog_id -> düz plan kaydı
export function indexCatalogPlans(catalog) {
  const index = new Map();
  for (const group of catalog) {
    for (const plan of group.plans) {
      index.set(plan.id, toCatalogEntry(group, plan));
    }
  }
  return index;
}

export function getCheapestPlan(group) {
  return group.plans.reduce(
    (cheapest, plan) => (!cheapest || planPriceTry(plan) < planPriceTry(cheapest) ? plan : cheapest),
    null
  );
}

export function sumMonthlyTry(items) {
  return items.reduce((sum, item) => sum + planPriceTry(item), 0);
}

import AsyncStorage from "@react-native-async-storage/async-storage";

// Misafir (giriş yapmamış) kullanıcının bu cihazda takip ettiği abonelikler.
// Yalnızca [{ catalog_id, added_at }] tutulur; fiyat, ad, logo ve kategori
// her zaman katalog API'sinden okunur ki zamlar misafirde de güncel görünsün.

const STORAGE_KEY = "guest_subscriptions";

// Misafirde takip edilebilecek azami abonelik. Sunucudaki FREE_LIMIT ile
// aynı tutulmalı; misafirin /auth/me çağrısı olmadığı için burada sabit.
export const GUEST_LIMIT = 5;

export async function getGuestSubscriptions() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => item?.catalog_id) : [];
  } catch (err) {
    return [];
  }
}

async function saveGuestSubscriptions(items) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

// Listeye ekler; limit doluysa ya da kayıt zaten varsa eklemez.
// Dönen değer: { added: boolean, reason?: "limit" | "duplicate", items }
export async function addGuestSubscription(catalogId) {
  const items = await getGuestSubscriptions();

  if (items.some((item) => item.catalog_id === catalogId)) {
    return { added: false, reason: "duplicate", items };
  }

  if (items.length >= GUEST_LIMIT) {
    return { added: false, reason: "limit", items };
  }

  const next = [...items, { catalog_id: catalogId, added_at: new Date().toISOString() }];
  await saveGuestSubscriptions(next);
  return { added: true, items: next };
}

// Birden çok kaydı sırayla ekler; limiti aşanlar ve tekrarlar atlanır.
// Eklenemeyen catalog_id'ler döner.
export async function addGuestSubscriptions(catalogIds) {
  const items = await getGuestSubscriptions();
  const next = [...items];
  const rejected = [];
  const now = new Date().toISOString();

  for (const catalogId of catalogIds) {
    if (next.some((item) => item.catalog_id === catalogId)) {
      continue;
    }
    if (next.length >= GUEST_LIMIT) {
      rejected.push(catalogId);
      continue;
    }
    next.push({ catalog_id: catalogId, added_at: now });
  }

  await saveGuestSubscriptions(next);
  return { items: next, rejected };
}

export async function removeGuestSubscription(catalogId) {
  const items = await getGuestSubscriptions();
  const next = items.filter((item) => item.catalog_id !== catalogId);
  await saveGuestSubscriptions(next);
  return next;
}

export async function clearGuestSubscriptions() {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

import AsyncStorage from "@react-native-async-storage/async-storage";

// Misafir (giriş yapmamış) kullanıcının bu cihazda takip ettiği abonelikler.
// [{ catalog_id, added_at, billing_date, billing_month }] tutulur; fiyat, ad,
// logo ve kategori her zaman katalog API'sinden okunur ki zamlar misafirde de
// güncel görünsün. Ödeme günü hesaba aktarımda bulk uca gönderilir.

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

// Kayıt: catalog_id (string) ya da { catalog_id, billing_date, billing_month }.
function toEntry(input, addedAt) {
  const source = typeof input === "string" ? { catalog_id: input } : input;
  return {
    catalog_id: source.catalog_id,
    added_at: addedAt,
    billing_date: source.billing_date ?? null,
    billing_month: source.billing_month ?? null,
  };
}

// Listeye ekler; limit doluysa ya da kayıt zaten varsa eklemez.
// Dönen değer: { added: boolean, reason?: "limit" | "duplicate", items }
export async function addGuestSubscription(input) {
  const entry = toEntry(input, new Date().toISOString());
  const items = await getGuestSubscriptions();

  if (items.some((item) => item.catalog_id === entry.catalog_id)) {
    return { added: false, reason: "duplicate", items };
  }

  if (items.length >= GUEST_LIMIT) {
    return { added: false, reason: "limit", items };
  }

  const next = [...items, entry];
  await saveGuestSubscriptions(next);
  return { added: true, items: next };
}

// Birden çok kaydı sırayla ekler; limiti aşanlar ve tekrarlar atlanır.
// Eklenemeyen catalog_id'ler döner.
export async function addGuestSubscriptions(inputs) {
  const items = await getGuestSubscriptions();
  const next = [...items];
  const rejected = [];
  const now = new Date().toISOString();

  for (const input of inputs) {
    const entry = toEntry(input, now);
    if (next.some((item) => item.catalog_id === entry.catalog_id)) {
      continue;
    }
    if (next.length >= GUEST_LIMIT) {
      rejected.push(entry.catalog_id);
      continue;
    }
    next.push(entry);
  }

  await saveGuestSubscriptions(next);
  return { items: next, rejected };
}

// Ödeme gününü günceller: updates = { billing_date, billing_month }.
export async function updateGuestSubscription(catalogId, updates) {
  const items = await getGuestSubscriptions();
  const next = items.map((item) =>
    item.catalog_id === catalogId
      ? {
          ...item,
          billing_date: updates.billing_date ?? null,
          billing_month: updates.billing_month ?? null,
        }
      : item
  );
  await saveGuestSubscriptions(next);
  return next;
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

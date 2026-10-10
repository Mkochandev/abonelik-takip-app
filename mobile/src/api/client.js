import { Platform } from "react-native";

import { translateAuthError } from "../utils/authErrors";

// Backend'e hangi adresten ulaşılacağı ortama göre değişir:
//
// - Android emulator (AVD, Android Studio ile açılan sanal cihaz):
//     10.0.2.2 kullan. Bu, emulator'ın kendi host'una (yani bu proje WSL
//     içinde çalıştığı için Windows'a) baktığı özel adrestir. WSL2,
//     "localhost forwarding" özelliği sayesinde Windows'a gelen
//     localhost:3000 isteklerini otomatik olarak WSL içindeki backend'e
//     yönlendirir, bu yüzden ekstra ayar gerekmez.
//
// - iOS simulator: Bu proje Windows/WSL üzerinde çalıştığı için iOS
//     simulator zaten kullanılamaz (Mac gerektirir), ama ileride Mac'te
//     çalıştırılırsa localhost:3000 doğrudan çalışır.
//
// - Gerçek telefon (Expo Go ile aynı Wi-Fi ağında): 10.0.2.2 ve
//     localhost ÇALIŞMAZ. Bilgisayarının (Windows host) yerel ağ IP'sini
//     kullanman gerekir:
//     1) Windows tarafında PowerShell'de "ipconfig" çalıştır, Wi-Fi/Ethernet
//        adaptöründeki IPv4 adresini bul (örn. 192.168.1.34).
//     2) mobile/.env dosyası oluştur (yoksa) ve şunu ekle:
//        EXPO_PUBLIC_API_URL=http://192.168.1.34:3000
//     3) Windows Güvenlik Duvarı 3000 portunu engelliyorsa izin ver.
//     4) Hâlâ bağlanamıyorsan (WSL2 varsayılan NAT modundaysa telefon gibi
//        LAN'daki cihazlar WSL'e direkt ulaşamayabilir), Windows'ta yönetici
//        PowerShell'de şu portproxy komutunu çalıştırman gerekebilir:
//        netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=<WSL_IP>
//        (<WSL_IP>'yi WSL içinde "hostname -I" ile öğrenebilirsin.)
//
// EXPO_PUBLIC_API_URL tanımlıysa (mobile/.env) her zaman o kullanılır,
// tanımlı değilse platforma göre makul bir varsayılana düşer.
function resolveBaseUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  if (Platform.OS === "android") {
    return "http://10.0.2.2:3000";
  }

  return "http://localhost:3000";
}

export const API_BASE_URL = resolveBaseUrl();

// AuthContext, oturumu SecureStore'da tuttuğu için refresh_token'a ve token
// güncelleme/oturum kapatma mantığına buradan erişebilmemiz gerekiyor.
// configureAuthClient ile bu davranışlar dışarıdan (AuthProvider mount
// olduğunda) enjekte edilir.
let authHandlers = {
  getRefreshToken: () => null,
  onTokenRefreshed: () => {},
  onSessionExpired: () => {},
};

export function configureAuthClient(handlers) {
  authHandlers = { ...authHandlers, ...handlers };
}

async function request(path, { method = "GET", token, body, isRetry = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (networkError) {
    throw new Error(
      `Sunucuya ulaşılamadı (${API_BASE_URL}). IP adresini ve backend'in çalıştığını kontrol et.`
    );
  }

  if (response.status === 401 && token && !isRetry) {
    const refreshToken = authHandlers.getRefreshToken();

    if (refreshToken) {
      try {
        const refreshed = await refresh(refreshToken);
        authHandlers.onTokenRefreshed(refreshed.session);
        return request(path, { method, token: refreshed.session.access_token, body, isRetry: true });
      } catch (refreshError) {
        authHandlers.onSessionExpired();
        throw new Error("Oturum süresi doldu, tekrar giriş yap");
      }
    }

    authHandlers.onSessionExpired();
  }

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const requestError = new Error(
      translateAuthError(data?.code, data?.error) || "Bilinmeyen bir hata oluştu"
    );
    requestError.code = data?.code;
    requestError.data = data;
    throw requestError;
  }

  return data;
}

export function register(email, password) {
  return request("/auth/register", { method: "POST", body: { email, password } });
}

export function login(email, password) {
  return request("/auth/login", { method: "POST", body: { email, password } });
}

export function logout(token) {
  return request("/auth/logout", { method: "POST", token });
}

export function refresh(refreshToken) {
  return request("/auth/refresh", { method: "POST", body: { refresh_token: refreshToken } });
}

export function deleteAccount(token) {
  return request("/auth/account", { method: "DELETE", token });
}

export function me(token) {
  return request("/auth/me", { method: "GET", token });
}

export function getCatalog(category) {
  const params = category ? `?category=${encodeURIComponent(category)}` : "";
  return request(`/catalog${params}`);
}

export function searchCatalog(query, category) {
  const params = new URLSearchParams({ q: query });
  if (category) {
    params.set("category", category);
  }
  return request(`/catalog/search?${params.toString()}`);
}

export function getCatalogItem(id) {
  return request(`/catalog/${id}`);
}

export function getUserSubscriptions(token) {
  return request("/user/subscriptions", { token });
}

export function addUserSubscription(token, catalogId, details = {}) {
  return request("/user/subscriptions", {
    method: "POST",
    token,
    body: { catalog_id: catalogId, ...details },
  });
}

// Birden çok katalog kaydını tek istekte ekler.
// items: [{ catalog_id, billing_date?, billing_month? }]
// Yanıt: { added, skipped: [{ catalog_id, reason }], limit_reached }
export function bulkAddUserSubscriptions(token, items) {
  return request("/user/subscriptions/bulk", {
    method: "POST",
    token,
    body: {
      items: items.map((item) => ({
        catalog_id: item.catalog_id,
        billing_date: item.billing_date ?? null,
        billing_month: item.billing_month ?? null,
      })),
    },
  });
}

export function updateUserSubscription(token, id, updates) {
  return request(`/user/subscriptions/${id}`, {
    method: "PATCH",
    token,
    body: updates,
  });
}

export function removeUserSubscription(token, id) {
  return request(`/user/subscriptions/${id}`, { method: "DELETE", token });
}

// "İptal ettim": kayıt kalır, toplamlardan ve sınırdan düşer. → { id, cancelled_at }
export function cancelUserSubscription(token, id) {
  return request(`/user/subscriptions/${id}/cancel`, { method: "POST", token });
}

// "Geri al": iptal işareti kalkar (ücretsiz planda sınır doluysa LIMIT_REACHED).
export function restoreUserSubscription(token, id) {
  return request(`/user/subscriptions/${id}/restore`, { method: "POST", token });
}

export function syncPlan(token) {
  return request("/user/plan/sync", { method: "POST", token });
}

// erişte Premium'u takip listesine ekler/günceller.
// body: { billing_cycle, price, currency, billing_date, billing_month }
// Yanıt: { status: "added" | "updated" | "dismissed" | "inactive" }
export function syncEristePremium(token, body) {
  return request("/user/subscriptions/eriste-premium", { method: "POST", token, body });
}

// --- Kıvırık soruları ve kullanıcı ayarları -------------------------------

// Yanıt: { total, trigger, questions: [{ key, user_subscription_id, period, event, params }] }
// trigger: en öndeki soru tetiklemeliyse (ör. cancel_verify) o soru, yoksa null.
export function getKivirikQuestions(token) {
  return request("/kivirik/questions", { token });
}

// body: { key, user_subscription_id, period, answer, value } → { ok, total, trigger }
export function answerKivirikQuestion(token, body) {
  return request("/kivirik/answers", { method: "POST", token, body });
}

// body: { key, user_subscription_id, mode: "later" | "never" } → { ok, total, trigger }
export function dismissKivirikQuestion(token, body) {
  return request("/kivirik/dismiss", { method: "POST", token, body });
}

// { reminder_days_before, is_student, monthly_budget } (sorulmamışlar null)
export function getUserSettings(token) {
  return request("/user/settings", { token });
}

export function updateUserSettings(token, updates) {
  return request("/user/settings", { method: "PUT", token, body: updates });
}

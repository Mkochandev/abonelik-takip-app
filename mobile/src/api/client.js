import { Platform } from "react-native";

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

async function request(path, { method = "GET", token, body } = {}) {
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

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || "Bilinmeyen bir hata oluştu");
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

export function me(token) {
  return request("/auth/me", { method: "GET", token });
}

export function getCatalog() {
  return request("/catalog");
}

export function searchCatalog(query) {
  return request(`/catalog/search?q=${encodeURIComponent(query)}`);
}

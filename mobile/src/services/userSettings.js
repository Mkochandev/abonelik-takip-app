import * as api from "../api/client";

// Hesaplı kullanıcının sunucudaki ayarları (user_settings) için küçük önbellek.
// Hatırlatma planlaması ve Ana sayfadaki bütçe uyarısı aynı değeri kullanır.

const EMPTY = { reminder_days_before: null, is_student: null, monthly_budget: null };

let cache = { token: null, settings: null };

export async function getUserSettings(token, { force = false } = {}) {
  if (!token) {
    return { ...EMPTY };
  }
  if (!force && cache.token === token && cache.settings) {
    return cache.settings;
  }
  const settings = await api.getUserSettings(token);
  cache = { token, settings };
  return settings;
}

export async function updateUserSettings(token, updates) {
  const settings = await api.updateUserSettings(token, updates);
  cache = { token, settings };
  return settings;
}

// Bir Kıvırık cevabı ayarı değiştirdiyse sonraki okuma sunucudan gelsin.
export function invalidateUserSettings() {
  cache = { token: null, settings: null };
}

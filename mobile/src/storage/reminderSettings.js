import AsyncStorage from "@react-native-async-storage/async-storage";

// Ödeme hatırlatma tercihleri (cihaz başına; misafir ve hesap için aynı).
// enabled: bildirimler planlansın mı, daysBefore: 0 (aynı gün) | 1 | 3,
// prompted: Kıvırık "haber vereyim mi?" diye sordu mu (bir kez sorulur).

const STORAGE_KEY = "reminder_settings";

export const DAYS_BEFORE_OPTIONS = [0, 1, 3];

const DEFAULTS = { enabled: false, daysBefore: 1, prompted: false };

export async function getReminderSettings() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : DEFAULTS.enabled,
      daysBefore: DAYS_BEFORE_OPTIONS.includes(parsed.daysBefore)
        ? parsed.daysBefore
        : DEFAULTS.daysBefore,
      prompted: typeof parsed.prompted === "boolean" ? parsed.prompted : DEFAULTS.prompted,
    };
  } catch (err) {
    return { ...DEFAULTS };
  }
}

export async function updateReminderSettings(updates) {
  const next = { ...(await getReminderSettings()), ...updates };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

import AsyncStorage from "@react-native-async-storage/async-storage";

const DONE_KEY = "onboarding_done";
const DRAFT_KEY = "onboarding_draft";
const GUEST_BANNER_DISMISSED_KEY = "guest_banner_dismissed_at";

// Kapatılan misafir uyarı kartı bu süre sonra yeniden görünür.
const GUEST_BANNER_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

export async function isOnboardingDone() {
  try {
    return (await AsyncStorage.getItem(DONE_KEY)) === "true";
  } catch (err) {
    return false;
  }
}

export async function setOnboardingDone() {
  await AsyncStorage.setItem(DONE_KEY, "true");
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// Taslak: { step, selectedApps: [app_name], planChoices: { app_name: catalog_id },
//   billingDays: { app_name: { day, month } | { unknown: true } } }
export async function loadOnboardingDraft() {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    const draft = raw ? JSON.parse(raw) : null;
    if (!draft || !Array.isArray(draft.selectedApps)) {
      return null;
    }
    return {
      step: typeof draft.step === "string" ? draft.step : null,
      selectedApps: draft.selectedApps.filter((name) => typeof name === "string"),
      planChoices: isPlainObject(draft.planChoices) ? draft.planChoices : {},
      billingDays: isPlainObject(draft.billingDays) ? draft.billingDays : {},
    };
  } catch (err) {
    return null;
  }
}

export async function saveOnboardingDraft(draft) {
  await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export async function clearOnboardingDraft() {
  await AsyncStorage.removeItem(DRAFT_KEY);
}

// Onboarding'i tamamlanmış say ve taslağı sil.
export async function finishOnboarding() {
  await Promise.all([setOnboardingDone(), clearOnboardingDraft()]);
}

// Yalnızca geliştirme amaçlı sıfırlama (bkz. ProfileScreen).
export async function resetOnboarding() {
  await AsyncStorage.multiRemove([DONE_KEY, DRAFT_KEY, GUEST_BANNER_DISMISSED_KEY]);
}

export async function shouldShowGuestBanner() {
  try {
    const raw = await AsyncStorage.getItem(GUEST_BANNER_DISMISSED_KEY);
    if (!raw) {
      return true;
    }
    return Date.now() - Number(raw) >= GUEST_BANNER_SNOOZE_MS;
  } catch (err) {
    return true;
  }
}

export async function dismissGuestBanner() {
  await AsyncStorage.setItem(GUEST_BANNER_DISMISSED_KEY, String(Date.now()));
}

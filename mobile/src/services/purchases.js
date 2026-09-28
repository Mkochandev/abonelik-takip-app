import { Platform } from "react-native";
import Purchases from "react-native-purchases";

// RevenueCat şimdilik yalnızca iOS anahtarıyla yapılandırılıyor (App Store
// aboneliği). Anahtar yoksa ya da platform iOS değilse tüm fonksiyonlar
// sessizce no-op olur, böylece Android/web'de veya anahtar eksikken uygulama
// çökmez.
const IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;

function isSupported() {
  return Platform.OS === "ios" && !!IOS_API_KEY;
}

let configured = false;

export function configurePurchases() {
  if (!isSupported() || configured) {
    return;
  }
  Purchases.configure({ apiKey: IOS_API_KEY });
  configured = true;
}

export async function identifyPurchasesUser(userId) {
  if (!isSupported()) {
    return;
  }
  configurePurchases();
  try {
    await Purchases.logIn(userId);
  } catch (err) {
    // Sessizce yok say; plan bilgisi backend'den (/auth/me) senkronize edilir.
  }
}

export async function signOutPurchasesUser() {
  if (!isSupported() || !configured) {
    return;
  }
  try {
    await Purchases.logOut();
  } catch (err) {
    // Zaten anonim olabilir (örn. hesap silindiğinde).
  }
}

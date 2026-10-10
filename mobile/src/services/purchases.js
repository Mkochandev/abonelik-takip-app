import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import Purchases from "react-native-purchases";

// RevenueCat şimdilik yalnızca iOS anahtarıyla yapılandırılıyor (App Store
// aboneliği). Anahtar yoksa ya da platform iOS değilse tüm fonksiyonlar
// sessizce no-op olur, böylece Android/web'de veya anahtar eksikken uygulama
// çökmez.
const IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;

// RevenueCat'teki Premium entitlement kimliği.
export const ENTITLEMENT_ID = "premium";

// Ürünün dönemi. Önce bilinen ürün kimlikleri (Android'de
// "premium_aylik:taban-plan" biçiminde olabilir), sonra paket türü, en son
// ürünün abonelik süresi (ISO 8601: P1M, P1Y). RevenueCat Test Store gibi
// farklı kimlikli ürünler ("monthly") böylece de tanınır.
export function cycleForProduct(productId, product, packageType) {
  if (productId?.startsWith("premium_yillik")) return "yearly";
  if (productId?.startsWith("premium_aylik")) return "monthly";
  if (packageType === "ANNUAL") return "yearly";
  if (packageType === "MONTHLY") return "monthly";
  const period = product?.subscriptionPeriod;
  if (period === "P1Y" || period === "P12M") return "yearly";
  if (period === "P1M" || period === "P4W") return "monthly";
  return null;
}

export function isPurchasesSupported() {
  return Platform.OS === "ios" && !!IOS_API_KEY;
}

let configured = false;

export function configurePurchases() {
  if (!isPurchasesSupported() || configured) {
    return;
  }
  Purchases.configure({ apiKey: IOS_API_KEY });
  configured = true;
}

export async function identifyPurchasesUser(userId) {
  if (!isPurchasesSupported()) {
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
  if (!isPurchasesSupported() || !configured) {
    return;
  }
  try {
    await Purchases.logOut();
  } catch (err) {
    // Zaten anonim olabilir (örn. hesap silindiğinde).
  }
}

// customerInfo -> { active, cycle, expirationDate, willRenew }. Dönem ürün
// kimliğinden çıkmazsa ürünün abonelik süresine bakılır.
async function premiumFromCustomerInfo(info) {
  const entitlement = info?.entitlements?.active?.[ENTITLEMENT_ID];
  if (!entitlement) {
    return { active: false, cycle: null, expirationDate: null, willRenew: false };
  }
  let cycle = cycleForProduct(entitlement.productIdentifier);
  if (!cycle) {
    const [product] = await Purchases.getProducts([entitlement.productIdentifier]).catch(() => []);
    cycle = cycleForProduct(entitlement.productIdentifier, product);
  }
  return {
    active: true,
    cycle,
    expirationDate: entitlement.expirationDate ? new Date(entitlement.expirationDate) : null,
    willRenew: entitlement.willRenew !== false,
  };
}

// RevenueCat'teki Premium durumu. Satın alma ve geri yüklemede RevenueCat
// dinleyicisi tetiklenir, durum anında güncellenir. RevenueCat
// desteklenmiyorsa (Android, anahtar yok) supported: false döner.
// apply(customerInfo): elde olan customerInfo ile hemen günceller.
export function usePremiumStatus() {
  const supported = isPurchasesSupported();
  const [status, setStatus] = useState({ loading: supported, active: false, cycle: null, expirationDate: null, willRenew: false });

  const apply = useCallback(async (info) => {
    const next = await premiumFromCustomerInfo(info);
    setStatus({ loading: false, ...next });
  }, []);

  useEffect(() => {
    if (!supported) {
      return undefined;
    }
    configurePurchases();
    let active = true;
    const listener = (info) => active && apply(info);
    Purchases.getCustomerInfo()
      .then(listener)
      .catch(() => active && setStatus((current) => ({ ...current, loading: false })));
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      active = false;
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [supported, apply]);

  return { supported, ...status, apply };
}

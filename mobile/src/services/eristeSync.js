import Purchases from "react-native-purchases";

import * as api from "../api/client";
import { ENTITLEMENT_ID, cycleForProduct, isPurchasesSupported } from "./purchases";
import { rescheduleAll } from "./reminders";

// erişte Premium'un kendisi de kullanıcının takip listesinde görünsün:
// RevenueCat'te "premium" entitlement aktifse kayıt sunucuya eklenir ya da
// güncellenir (plan, App Store fiyatı, yenileme tarihinden ödeme günü).
// Premium bitince kayıt silinmez; sunucu managed_active: false döner.
// Kullanıcı kaydı listesinden silerse sunucu bunu saklar ve tekrar eklemez.

// Kullanıcının App Store'da gördüğü ürün (fiyat ve dönem için): önce teklif
// paketlerinden, yoksa ürün sorgusundan. { product, packageType } ya da null.
async function findStoreProduct(productId) {
  try {
    const offerings = await Purchases.getOfferings();
    for (const offering of Object.values(offerings.all ?? {})) {
      const pkg = offering.availablePackages.find((item) => item.product.identifier === productId);
      if (pkg) {
        return { product: pkg.product, packageType: pkg.packageType };
      }
    }
  } catch (err) {
    // Ürün sorgusuna düş.
  }

  const [product] = await Purchases.getProducts([productId]).catch(() => []);
  return product ? { product, packageType: null } : null;
}

// Yalnızca geliştirmede: eşitlemenin nerede durduğu Metro konsolunda görünsün.
function devLog(...args) {
  if (__DEV__) {
    console.log("[erişte sync]", ...args);
  }
}

const listeners = new Set();

// Kayıt eklendi/güncellendiğinde (ör. Ana sayfa listeyi yeniden yüklesin).
export function subscribeEristeChanges(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let inFlight = null;

// customerInfo verilirse (satın alma sonucu) yeniden sorgulanmaz.
// Dönen değer: sunucu durumu ("added" | "updated" | ...) ya da null.
export function syncEristePremium(token, customerInfo) {
  if (!token || !isPurchasesSupported()) {
    return Promise.resolve(null);
  }

  if (!inFlight) {
    inFlight = (async () => {
      try {
        const info = customerInfo ?? (await Purchases.getCustomerInfo());
        const entitlement = info.entitlements.active[ENTITLEMENT_ID];
        if (!entitlement) {
          devLog("aktif premium entitlement yok");
          return null;
        }

        const store = await findStoreProduct(entitlement.productIdentifier);
        const billingCycle = cycleForProduct(
          entitlement.productIdentifier,
          store?.product,
          store?.packageType
        );
        if (!store || !billingCycle) {
          devLog("ürün tanınmadı:", entitlement.productIdentifier, store?.product?.subscriptionPeriod);
          return null;
        }

        // Yenileme tarihi cihazın saat diliminde okunur (gün kaymasın).
        const renewal = entitlement.expirationDate ?? info.latestExpirationDate;
        const renewalDate = renewal ? new Date(renewal) : null;

        const { status } = await api.syncEristePremium(token, {
          billing_cycle: billingCycle,
          price: store.product.price,
          currency: store.product.currencyCode,
          billing_date: renewalDate ? renewalDate.getDate() : null,
          billing_month:
            renewalDate && billingCycle === "yearly" ? renewalDate.getMonth() + 1 : null,
        });

        devLog("sunucu:", status, billingCycle, entitlement.productIdentifier);
        if (status === "added" || status === "updated") {
          listeners.forEach((listener) => listener(status));
          rescheduleAll();
        }
        return status;
      } catch (err) {
        // Kullanıcıya gösterilmez; bir sonraki açılışta tekrar denenir.
        devLog("hata:", err.message);
        return null;
      }
    })().finally(() => {
      inFlight = null;
    });
  }

  return inFlight;
}

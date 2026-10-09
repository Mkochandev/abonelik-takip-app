import Purchases from "react-native-purchases";

import * as api from "../api/client";
import { isPurchasesSupported } from "./purchases";
import { rescheduleAll } from "./reminders";

// erişte Premium'un kendisi de kullanıcının takip listesinde görünsün:
// RevenueCat'te "premium" entitlement aktifse kayıt sunucuya eklenir ya da
// güncellenir (plan, App Store fiyatı, yenileme tarihinden ödeme günü).
// Premium bitince kayıt silinmez; sunucu managed_active: false döner.
// Kullanıcı kaydı listesinden silerse sunucu bunu saklar ve tekrar eklemez.

const ENTITLEMENT_ID = "premium";

// Android'de ürün kimliği "premium_aylik:taban-plan" biçiminde olabilir.
function cycleForProduct(productId) {
  if (productId?.startsWith("premium_yillik")) return "yearly";
  if (productId?.startsWith("premium_aylik")) return "monthly";
  return null;
}

// Kullanıcının App Store'da gördüğü fiyat: önce teklif paketlerinden, yoksa
// ürün sorgusundan.
async function findStorePrice(productId) {
  try {
    const offerings = await Purchases.getOfferings();
    for (const offering of Object.values(offerings.all ?? {})) {
      const pkg = offering.availablePackages.find((item) => item.product.identifier === productId);
      if (pkg) {
        return { price: pkg.product.price, currency: pkg.product.currencyCode };
      }
    }
  } catch (err) {
    // Ürün sorgusuna düş.
  }

  const [product] = await Purchases.getProducts([productId]).catch(() => []);
  return product ? { price: product.price, currency: product.currencyCode } : null;
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
          return null;
        }

        const billingCycle = cycleForProduct(entitlement.productIdentifier);
        const storePrice = billingCycle ? await findStorePrice(entitlement.productIdentifier) : null;
        if (!billingCycle || !storePrice) {
          return null;
        }

        // Yenileme tarihi cihazın saat diliminde okunur (gün kaymasın).
        const renewal = entitlement.expirationDate ?? info.latestExpirationDate;
        const renewalDate = renewal ? new Date(renewal) : null;

        const { status } = await api.syncEristePremium(token, {
          billing_cycle: billingCycle,
          price: storePrice.price,
          currency: storePrice.currency,
          billing_date: renewalDate ? renewalDate.getDate() : null,
          billing_month:
            renewalDate && billingCycle === "yearly" ? renewalDate.getMonth() + 1 : null,
        });

        if (status === "added" || status === "updated") {
          listeners.forEach((listener) => listener(status));
          rescheduleAll();
        }
        return status;
      } catch (err) {
        // Sessizce yok say; bir sonraki açılışta tekrar denenir.
        return null;
      }
    })().finally(() => {
      inFlight = null;
    });
  }

  return inFlight;
}

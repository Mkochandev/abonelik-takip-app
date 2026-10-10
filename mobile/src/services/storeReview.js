import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert, Linking } from "react-native";
import * as StoreReview from "expo-store-review";

import { APP_STORE_ID } from "../config/brand";

// Mağaza puanlama isteği (yerleşik API; kendi "beğendin mi?" sorumuz yok).
// Yalnızca iyi anlarda çağrılır: onboarding kaydı tamamlanınca ve Kıvırık
// soru panelinin bitiş ekranında. Hata, paywall, iptal ve silme
// akışlarından sonra çağıran taraf bunu çağırmaz.

const LAST_REQUEST_KEY = "store_review_last_request_at";
const OPEN_DAYS_KEY = "store_review_open_days";

const MIN_SUBSCRIPTIONS = 3;
const MIN_OPEN_DAYS = 2;
const COOLDOWN_MS = 120 * 24 * 60 * 60 * 1000;
// İstek, tetikleyen ekran geçişi bittikten sonra gösterilsin.
const REQUEST_DELAY_MS = 1200;

function localDay(date = new Date()) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

async function readOpenDays() {
  try {
    const days = JSON.parse((await AsyncStorage.getItem(OPEN_DAYS_KEY)) ?? "[]");
    return Array.isArray(days) ? days : [];
  } catch (err) {
    return [];
  }
}

// Uygulama açıldığında / ön plana döndüğünde. Yalnızca farklı gün sayısı
// gerektiği için en fazla MIN_OPEN_DAYS gün saklanır.
export async function recordAppOpen() {
  try {
    const days = await readOpenDays();
    const today = localDay();
    if (days.length >= MIN_OPEN_DAYS || days.includes(today)) return;
    await AsyncStorage.setItem(OPEN_DAYS_KEY, JSON.stringify([...days, today]));
  } catch (err) {
    // Sayılmazsa istek yalnızca gecikir.
  }
}

// Koşullar: en az 3 abonelik, en az 2 farklı açılış günü, son istekten bu
// yana 120 gün. Hepsi tutarsa sistem penceresi istenir (iOS gösterip
// göstermemeye kendi karar verir).
export async function maybeRequestReview(subscriptionCount) {
  try {
    if (subscriptionCount < MIN_SUBSCRIPTIONS) return false;
    if ((await readOpenDays()).length < MIN_OPEN_DAYS) return false;
    const last = Number(await AsyncStorage.getItem(LAST_REQUEST_KEY));
    if (last && Date.now() - last < COOLDOWN_MS) return false;
    if (!(await StoreReview.isAvailableAsync()) || !(await StoreReview.hasAction())) return false;

    await AsyncStorage.setItem(LAST_REQUEST_KEY, String(Date.now()));
    setTimeout(() => StoreReview.requestReview().catch(() => {}), REQUEST_DELAY_MS);
    return true;
  } catch (err) {
    return false;
  }
}

// Profil'deki "Uygulamayı değerlendir": App Store'un yorum yazma sayfası.
export function openWriteReview() {
  if (!APP_STORE_ID) {
    Alert.alert("Henüz hazır değil", "Mağaza bağlantısı yakında eklenecek.");
    return;
  }
  Linking.openURL(`itms-apps://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`).catch(() => {});
}

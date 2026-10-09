import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

import { getReminderSettings, updateReminderSettings } from "../storage/reminderSettings";
import { buildReminderPlan } from "../utils/reminderPlan";
import { loadSubscriptions } from "./subscriptionsSource";

// Cihazda planlanan (yerel) ödeme hatırlatmaları. Push sunucusu yok: her
// açılışta ve abonelik/gün/fiyat değiştiğinde rescheduleAll tüm bildirimleri
// silip baştan kurar (idempotent).

const CHANNEL_ID = "payment-reminders";

// iOS en fazla 64 bekleyen yerel bildirim tutar; test bildirimi gibi ekstra
// kayıtlar için pay bırakılır.
const MAX_SCHEDULED = 60;

const REMINDER_KIND = "payment-reminder";

// AuthContext'teki güncel oturum; ekranlar token taşımadan senkron isteyebilsin.
let currentToken = null;

export function setReminderToken(token) {
  currentToken = token ?? null;
}

// Uygulama açılışında bir kez: ön plandayken de bildirim gösterilsin ve
// Android kanalı hazır olsun.
export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === "android") {
    Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Ödeme hatırlatmaları",
      importance: Notifications.AndroidImportance.DEFAULT,
    }).catch(() => {});
  }
}

export async function hasNotificationPermission() {
  const { granted } = await Notifications.getPermissionsAsync();
  return granted;
}

// Sistem iznini ister (zaten verildiyse sormadan true döner).
export async function requestNotificationPermission() {
  if (await hasNotificationPermission()) {
    return true;
  }
  const { granted } = await Notifications.requestPermissionsAsync();
  return granted;
}

// Yalnızca bizim planladığımız ödeme hatırlatmalarını siler (test bildirimi
// gibi diğer kayıtlar kalır).
async function cancelPaymentReminders() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((request) => request.content.data?.kind === REMINDER_KIND)
      .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier))
  );
}

async function reschedule(subscriptionsOverride) {
  const settings = await getReminderSettings();

  if (!settings.enabled || !(await hasNotificationPermission())) {
    await cancelPaymentReminders();
    return;
  }

  // Liste yüklenemezse (ağ hatası) mevcut plan olduğu gibi bırakılır.
  let subscriptions = subscriptionsOverride;
  if (!subscriptions) {
    try {
      subscriptions = await loadSubscriptions(currentToken);
    } catch (err) {
      return;
    }
  }

  const plan = buildReminderPlan(subscriptions, {
    daysBefore: settings.daysBefore,
    limit: MAX_SCHEDULED,
  });

  await cancelPaymentReminders();

  for (const reminder of plan) {
    await Notifications.scheduleNotificationAsync({
      content: {
        body: reminder.body,
        data: { kind: REMINDER_KIND, subscriptionId: reminder.subscriptionId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminder.triggerDate,
        channelId: CHANNEL_ID,
      },
    });
  }
}

let running = null;
let pending = null;

// Tüm hatırlatmaları baştan planlar. Eşzamanlı çağrılar sıraya girer; çalışan
// bir planlama varsa yalnızca en son istek bir kez daha çalıştırılır.
// subscriptions verilirse (ör. Ana sayfanın az önce yüklediği liste) tekrar
// yüklenmez.
export function rescheduleAll(subscriptions) {
  pending = { subscriptions };

  if (!running) {
    running = (async () => {
      while (pending) {
        const request = pending;
        pending = null;
        await reschedule(request.subscriptions).catch(() => {});
      }
    })().finally(() => {
      running = null;
    });
  }

  return running;
}

// --- Kıvırık'ın "haber vereyim mi?" sorusu ----------------------------------

let promptListener = null;

// ReminderPromptHost kendini buraya kaydeder.
export function setReminderPromptListener(listener) {
  promptListener = listener;
  return () => {
    if (promptListener === listener) {
      promptListener = null;
    }
  };
}

// Kullanıcı ilk kez ödeme günü girdiğinde çağrılır; daha önce sorulduysa bir
// şey yapmaz. Açık bir sayfa (Modal) kapanırken yenisi iOS'ta açılamadığı
// için soru kısa bir gecikmeyle gösterilir.
export async function maybeAskForReminders() {
  const settings = await getReminderSettings();
  if (settings.prompted || !promptListener) {
    return;
  }
  setTimeout(() => promptListener?.(), 500);
}

// Sorunun cevabı. accept: sistem izni istenir; verilirse 1 gün önce
// hatırlatma açılır. Dönen değer: izin verildi mi (reddedildiyse false).
export async function answerReminderPrompt(accept) {
  if (!accept) {
    await updateReminderSettings({ prompted: true, enabled: false });
    return false;
  }

  const granted = await requestNotificationPermission();
  await updateReminderSettings({ prompted: true, enabled: granted, daysBefore: 1 });
  await rescheduleAll();
  return granted;
}

// Yalnızca geliştirme: 1 dakika sonrasına örnek bir hatırlatma.
export async function scheduleTestReminder() {
  if (!(await requestNotificationPermission())) {
    return false;
  }
  await Notifications.scheduleNotificationAsync({
    content: { body: "Yarın Netflix ödemen var: 229,99 TL", data: { kind: "test" } },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 60,
      channelId: CHANNEL_ID,
    },
  });
  return true;
}

import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import Purchases from "react-native-purchases";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as api from "../api/client";
import { BrandLogo, Card, Chip, GroupedList, GroupedListRow, PillButton, Toggle } from "../components";
import { useAuth } from "../context/AuthContext";
import { syncEristePremium } from "../services/eristeSync";
import { ENTITLEMENT_ID, usePremiumStatus } from "../services/purchases";
import { openWriteReview } from "../services/storeReview";
import {
  rescheduleAll,
  requestNotificationPermission,
  scheduleTestReminder,
} from "../services/reminders";
import { clearGuestSubscriptions } from "../storage/guestSubscriptions";
import { resetOnboarding } from "../storage/onboarding";
import {
  DAYS_BEFORE_OPTIONS,
  getReminderSettings,
  updateReminderSettings,
} from "../storage/reminderSettings";
import { getUserSettings, updateUserSettings } from "../services/userSettings";
import { fontFamily, useTheme } from "../theme";
import { buildOnboardingRoute } from "./onboarding/steps";

const DAYS_BEFORE_LABELS = { 0: "Aynı gün", 1: "1 gün önce", 3: "3 gün önce", 7: "1 hafta önce" };

function showPermissionDeniedAlert() {
  Alert.alert(
    "Bildirim izni kapalı",
    "Hatırlatmaları açmak için ayarlardan bildirimlere izin ver.",
    [
      { text: "Vazgeç", style: "cancel" },
      { text: "Ayarlar", onPress: () => Linking.openSettings() },
    ]
  );
}

// Ödeme hatırlatmaları: aç/kapa ve kaç gün önce. Misafirde de çalışır.
// Aç/kapa cihazda; "kaç gün önce" hesaplı kullanıcıda sunucuda
// (user_settings.reminder_days_before, sorulmadıysa 1), misafirde cihazda.
function ReminderSettingsSection() {
  const { token } = useAuth();
  const { colors, spacing } = useTheme();
  const [settings, setSettings] = useState(null);
  const [serverDays, setServerDays] = useState(null);

  // Kıvırık'ın sorusu başka bir ekranda cevaplanmış olabilir; her odakta oku.
  useFocusEffect(
    useCallback(() => {
      getReminderSettings().then(setSettings);
      if (token) {
        getUserSettings(token)
          .then((next) => setServerDays(next.reminder_days_before ?? 1))
          .catch(() => setServerDays(1));
      }
    }, [token])
  );

  const daysBefore = token ? serverDays ?? 1 : settings?.daysBefore;

  async function apply(updates) {
    setSettings(await updateReminderSettings(updates));
    rescheduleAll();
  }

  async function chooseDays(days) {
    if (!token) {
      await apply({ daysBefore: days });
      return;
    }
    const previous = serverDays;
    setServerDays(days);
    try {
      await updateUserSettings(token, { reminder_days_before: days });
      rescheduleAll();
    } catch (err) {
      setServerDays(previous);
      Alert.alert("Kaydedilemedi", err.message);
    }
  }

  async function handleToggle(value) {
    if (value && !(await requestNotificationPermission())) {
      showPermissionDeniedAlert();
      return;
    }
    // Elle açıp kapatan kullanıcıya Kıvırık ayrıca sormaz.
    await apply({ enabled: value, prompted: true });
  }

  if (!settings) {
    return null;
  }

  return (
    <GroupedList style={{ marginBottom: spacing.lg }}>
      <GroupedListRow style={{ justifyContent: "space-between" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "600" }}>Ödeme hatırlatmaları</Text>
          <Text style={{ color: colors.text2, fontSize: 13, marginTop: 2 }}>
            Ödeme gününden önce, saat 10:00 civarı
          </Text>
        </View>
        <Toggle value={settings.enabled} onValueChange={handleToggle} />
      </GroupedListRow>
      {settings.enabled ? (
        <GroupedListRow style={{ flexWrap: "wrap" }}>
          {DAYS_BEFORE_OPTIONS.map((days) => (
            <Chip
              key={days}
              label={DAYS_BEFORE_LABELS[days]}
              selected={daysBefore === days}
              onPress={() => chooseDays(days)}
            />
          ))}
        </GroupedListRow>
      ) : null}
    </GroupedList>
  );
}

// Yalnızca __DEV__: 1 dakika sonrasına örnek hatırlatma planlar.
function DevTestNotificationButton() {
  const { spacing } = useTheme();

  if (!__DEV__) {
    return null;
  }

  async function handlePress() {
    if (await scheduleTestReminder()) {
      Alert.alert("Planlandı", "Bildirim 1 dakika sonra gelecek. Uygulamayı arka plana alabilirsin.");
    } else {
      showPermissionDeniedAlert();
    }
  }

  return (
    <PillButton
      title="Test bildirimi: 1 dk sonra (dev)"
      variant="outline"
      onPress={handlePress}
      style={{ marginTop: spacing.sm }}
    />
  );
}

const PRIVACY_URL = "https://abonelik-api.gaziustam.com/privacy.html";
const TERMS_URL = "https://abonelik-api.gaziustam.com/terms.html";
const MANAGE_SUBSCRIPTION_URL = "https://apps.apple.com/account/subscriptions";

// Profil satırı: solda başlık, sağda ok ya da yükleniyor.
function LinkRow({ title, onPress, busy = false }) {
  const { colors } = useTheme();

  return (
    <GroupedListRow onPress={busy ? undefined : onPress} style={{ justifyContent: "space-between" }}>
      <Text style={{ color: colors.text, fontWeight: "600" }}>{title}</Text>
      {busy ? (
        <ActivityIndicator color={colors.text2} />
      ) : (
        <Text style={{ color: colors.text2, fontSize: 18 }}>›</Text>
      )}
    </GroupedListRow>
  );
}

// "Uygulamayı değerlendir" yalnızca iOS'ta (App Store yorum sayfası).
function RateAppRow() {
  return Platform.OS === "ios" ? <LinkRow title="Uygulamayı değerlendir" onPress={openWriteReview} /> : null;
}

function formatLongDate(date) {
  return date.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
}

// erişte Premium kartı ve "Satın almaları geri yükle". Durum RevenueCat'ten
// okunur; satın alma/geri yüklemede RevenueCat dinleyicisiyle anında
// güncellenir. RevenueCat yoksa (Android) sunucudaki plana bakılır.
function PremiumSection({ navigation }) {
  const { token, plan, refreshPlan } = useAuth();
  const { spacing, radius, brand } = useTheme();
  const premium = usePremiumStatus();
  const [restoring, setRestoring] = useState(false);
  const isPremium = premium.supported ? premium.active : plan === "premium";

  async function handleRestore() {
    if (!premium.supported) {
      Alert.alert("Geri yüklenemedi", "Satın almalar yalnızca iPhone'da geri yüklenebilir.");
      return;
    }
    setRestoring(true);
    try {
      const info = await Purchases.restorePurchases();
      await premium.apply(info);
      await api.syncPlan(token).catch(() => {});
      await refreshPlan();
      const restored = Boolean(info.entitlements.active[ENTITLEMENT_ID]);
      if (restored) {
        syncEristePremium(token, info);
      }
      Alert.alert(
        restored ? "Tamamlandı" : "Satın alma bulunamadı",
        restored
          ? "Premium geri yüklendi."
          : "Bu Apple hesabında geri yüklenecek bir Premium satın alma yok."
      );
    } catch (err) {
      Alert.alert("Geri yüklenemedi", err.message);
    } finally {
      setRestoring(false);
    }
  }

  const cycleLabel = premium.cycle === "yearly" ? "Yıllık" : premium.cycle === "monthly" ? "Aylık" : null;
  const dateLabel = premium.expirationDate
    ? `${premium.willRenew ? "Yenilenme" : "Bitiş"}: ${formatLongDate(premium.expirationDate)}`
    : null;

  return (
    <>
      <View
        style={{
          backgroundColor: brand.ink,
          borderRadius: radius.card,
          padding: spacing.lg,
          marginBottom: spacing.sm,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <BrandLogo size={44} variant="biber" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fontFamily.extraBold, fontSize: 19, color: "#FFFFFF" }}>
              erişte Premium
            </Text>
            {!premium.loading && !isPremium ? (
              <Text style={{ color: "#FFFFFF", opacity: 0.8, fontSize: 14, marginTop: 2 }}>
                5 yerine sınırsız abonelik takibi.
              </Text>
            ) : null}
          </View>
          {premium.loading ? <ActivityIndicator color="#FFFFFF" /> : null}
        </View>

        {premium.loading ? null : isPremium ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md }}>
              <View
                style={{
                  backgroundColor: brand.safran,
                  borderRadius: 999,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "800", color: brand.ink }}>Premium aktif</Text>
              </View>
              {cycleLabel ? (
                <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>{cycleLabel}</Text>
              ) : null}
            </View>
            {dateLabel ? (
              <Text style={{ color: "#FFFFFF", opacity: 0.8, fontSize: 14, marginTop: spacing.sm }}>
                {dateLabel}
              </Text>
            ) : null}
            <Pressable
              onPress={() => Linking.openURL(MANAGE_SUBSCRIPTION_URL)}
              accessibilityRole="button"
              style={({ pressed }) => ({
                height: 48,
                borderRadius: 24,
                borderWidth: 1.5,
                borderColor: "rgba(255,255,255,0.6)",
                alignItems: "center",
                justifyContent: "center",
                marginTop: spacing.md,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>Aboneliği yönet</Text>
            </Pressable>
          </>
        ) : (
          <PillButton
            title="Premium'a geç"
            variant="accent"
            onPress={() => navigation.navigate("Paywall")}
            style={{ marginTop: spacing.md }}
          />
        )}
      </View>

      <GroupedList style={{ marginBottom: spacing.lg }}>
        <LinkRow title="Satın almaları geri yükle" onPress={handleRestore} busy={restoring} />
      </GroupedList>
    </>
  );
}

// Yalnızca __DEV__: onboarding bayrağını, taslağı ve misafir listesini
// silip uygulamayı onboarding'in başına döndürür.
function DevResetOnboardingButton({ navigation }) {
  const { spacing } = useTheme();

  if (!__DEV__) {
    return null;
  }

  async function handlePress() {
    await Promise.all([resetOnboarding(), clearGuestSubscriptions()]).catch(() => {});
    navigation.getParent()?.reset({ index: 0, routes: [buildOnboardingRoute(null)] });
  }

  return (
    <PillButton
      title="Onboarding'i sıfırla (dev)"
      variant="outline"
      onPress={handlePress}
      style={{ marginTop: spacing.lg }}
    />
  );
}

export default function ProfileScreen({ navigation }) {
  const { user, isAuthenticated, logout, deleteAccount } = useAuth();
  const { colors, spacing, radius, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!isAuthenticated) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{
          padding: spacing.md,
          paddingTop: insets.top + spacing.sm,
          paddingBottom: spacing.xl,
        }}
      >
        <Text style={[typography.screenTitle, { color: colors.text, marginBottom: spacing.lg }]}>
          Profil
        </Text>

        <Card>
          <Text style={[typography.sectionTitle, { color: colors.text }]}>Hesabın yok mu?</Text>
          <Text style={{ color: colors.text2, marginTop: spacing.sm, lineHeight: 21 }}>
            Aboneliklerin şu an sadece bu cihazda. Hesap oluşturursan kaybolmaz ve zam olduğunda
            haber veririz.
          </Text>

          <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
            <PillButton title="Kayıt ol" onPress={() => navigation.navigate("Register")} />
            <PillButton
              title="Giriş yap"
              variant="outline"
              onPress={() => navigation.navigate("Login")}
            />
          </View>
        </Card>

        <View style={{ height: spacing.lg }} />
        <ReminderSettingsSection />

        <GroupedList>
          <GroupedListRow
            onPress={() => Linking.openURL(TERMS_URL)}
            style={{ justifyContent: "space-between" }}
          >
            <Text style={{ color: colors.text, fontWeight: "600" }}>Kullanım koşulları</Text>
            <Text style={{ color: colors.text2, fontSize: 18 }}>›</Text>
          </GroupedListRow>
          <GroupedListRow
            onPress={() => Linking.openURL(PRIVACY_URL)}
            style={{ justifyContent: "space-between" }}
          >
            <Text style={{ color: colors.text, fontWeight: "600" }}>Gizlilik politikası</Text>
            <Text style={{ color: colors.text2, fontSize: 18 }}>›</Text>
          </GroupedListRow>
          <RateAppRow />
        </GroupedList>

        <DevResetOnboardingButton navigation={navigation} />
        <DevTestNotificationButton />
      </ScrollView>
    );
  }

  async function handleConfirmDelete() {
    setDeleting(true);
    try {
      await deleteAccount();
      setConfirmVisible(false);
    } catch (err) {
      Alert.alert("Hata", err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        padding: spacing.md,
        paddingTop: insets.top + spacing.sm,
        paddingBottom: spacing.xl,
      }}
    >
      <Text style={[typography.screenTitle, { color: colors.text, marginBottom: spacing.lg }]}>
        Profil
      </Text>

      <PremiumSection navigation={navigation} />

      <ReminderSettingsSection />

      <GroupedList style={{ marginBottom: spacing.lg }}>
        <GroupedListRow style={{ justifyContent: "space-between" }}>
          <Text style={{ color: colors.text2 }}>E-posta</Text>
          <Text style={{ color: colors.text, fontWeight: "600" }}>{user?.email}</Text>
        </GroupedListRow>
        <GroupedListRow
          onPress={() => Linking.openURL(TERMS_URL)}
          style={{ justifyContent: "space-between" }}
        >
          <Text style={{ color: colors.text, fontWeight: "600" }}>Kullanım koşulları</Text>
          <Text style={{ color: colors.text2, fontSize: 18 }}>›</Text>
        </GroupedListRow>
        <GroupedListRow
          onPress={() => Linking.openURL(PRIVACY_URL)}
          style={{ justifyContent: "space-between" }}
        >
          <Text style={{ color: colors.text, fontWeight: "600" }}>Gizlilik politikası</Text>
          <Text style={{ color: colors.text2, fontSize: 18 }}>›</Text>
        </GroupedListRow>
        <RateAppRow />
      </GroupedList>

      <PillButton title="Çıkış yap" variant="outline" onPress={logout} style={{ marginBottom: spacing.sm }} />
      <PillButton title="Hesabımı sil" variant="danger" onPress={() => setConfirmVisible(true)} />

      <DevResetOnboardingButton navigation={navigation} />
      <DevTestNotificationButton />

      <Modal
        visible={confirmVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setConfirmVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: "flex-end" }}>
          <Pressable style={{ flex: 1 }} onPress={() => !deleting && setConfirmVisible(false)} />

          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: radius.sheet,
              borderTopRightRadius: radius.sheet,
              padding: spacing.lg,
              paddingBottom: insets.bottom + spacing.lg,
            }}
          >
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.divider,
                alignSelf: "center",
                marginBottom: spacing.md,
              }}
            />

            <Text style={{ fontFamily: fontFamily.extraBold, fontSize: 22, color: colors.text }}>
              Hesabını silmek istiyor musun?
            </Text>
            <Text style={{ color: colors.text2, marginTop: spacing.sm, lineHeight: 21 }}>
              Bu işlem geri alınamaz; hesabın ve kayıtlı tüm abonelik seçimlerin kalıcı olarak
              silinir. App Store üzerinden satın aldığın bir abonelik varsa, hesabını silmek onu
              otomatik iptal etmez.
            </Text>

            <Pressable onPress={() => Linking.openURL(MANAGE_SUBSCRIPTION_URL)} style={{ marginTop: spacing.sm }}>
              <Text style={{ color: colors.text, fontWeight: "700", textDecorationLine: "underline" }}>
                Aboneliği yönet
              </Text>
            </Pressable>

            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg }}>
              <PillButton
                title="Vazgeç"
                variant="outline"
                onPress={() => setConfirmVisible(false)}
                disabled={deleting}
                style={{ flex: 1 }}
              />
              <PillButton
                title="Hesabımı sil"
                variant="danger"
                onPress={handleConfirmDelete}
                loading={deleting}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

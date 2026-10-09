import { useCallback, useState } from "react";
import { Alert, Linking, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card, Chip, GroupedList, GroupedListRow, PillButton, Toggle } from "../components";
import { useAuth } from "../context/AuthContext";
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
  const { user, isAuthenticated, plan, logout, deleteAccount } = useAuth();
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

      <ReminderSettingsSection />

      <GroupedList style={{ marginBottom: spacing.lg }}>
        <GroupedListRow style={{ justifyContent: "space-between" }}>
          <Text style={{ color: colors.text2 }}>E-posta</Text>
          <Text style={{ color: colors.text, fontWeight: "600" }}>{user?.email}</Text>
        </GroupedListRow>
        {plan === "premium" ? (
          <>
            <GroupedListRow style={{ justifyContent: "space-between" }}>
              <Text style={{ color: colors.text2 }}>Plan</Text>
              <View
                style={{
                  backgroundColor: colors.accent,
                  borderRadius: 999,
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.onAccent }}>
                  Premium
                </Text>
              </View>
            </GroupedListRow>
            <GroupedListRow
              onPress={() => Linking.openURL(MANAGE_SUBSCRIPTION_URL)}
              style={{ justifyContent: "space-between" }}
            >
              <Text style={{ color: colors.text, fontWeight: "600" }}>Aboneliği yönet</Text>
              <Text style={{ color: colors.text2, fontSize: 18 }}>›</Text>
            </GroupedListRow>
          </>
        ) : null}
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

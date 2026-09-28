import { useState } from "react";
import { Alert, Linking, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card, GroupedList, GroupedListRow, PillButton } from "../components";
import { useAuth } from "../context/AuthContext";
import { fontFamily, useTheme } from "../theme";

const PRIVACY_URL = "https://abonelik-api.gaziustam.com/privacy.html";
const TERMS_URL = "https://abonelik-api.gaziustam.com/terms.html";
const MANAGE_SUBSCRIPTION_URL = "https://apps.apple.com/account/subscriptions";

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
          <Text style={{ color: colors.text2, marginTop: spacing.sm }}>
            Aboneliklerini takip edebilmek için giriş yap ya da hesap oluştur.
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

        <GroupedList style={{ marginTop: spacing.lg }}>
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

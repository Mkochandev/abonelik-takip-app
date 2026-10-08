import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandLogo, PillButton } from "../components";
import { GUEST_LIMIT } from "../storage/guestSubscriptions";
import { fontFamily, useTheme } from "../theme";

const PROMPT_MESSAGE = "Daha fazla abonelik için hesap oluştur";

// Misafir GUEST_LIMIT'e ulaştığında açılır: önce giriş/kayıt, ardından
// (Login/Register'a verilen next parametresiyle) Paywall.
export default function GuestLimitScreen({ navigation }) {
  const { colors, spacing, radius, brand } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        padding: spacing.md,
        paddingTop: insets.top + spacing.sm,
        paddingBottom: insets.bottom + spacing.lg,
      }}
    >
      <Pressable
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Kapat"
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: colors.card,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: spacing.md,
        }}
      >
        <Text style={{ fontSize: 20, color: colors.text }}>‹</Text>
      </Pressable>

      <View
        style={{
          backgroundColor: brand.ink,
          borderRadius: radius.card,
          padding: spacing.lg,
          alignItems: "center",
          marginBottom: spacing.lg,
        }}
      >
        <BrandLogo size={64} variant="biber" />
        <Text
          style={{
            fontFamily: fontFamily.extraBold,
            fontSize: 26,
            color: "#FFFFFF",
            marginTop: spacing.md,
            textAlign: "center",
          }}
        >
          Premium için hesap oluştur
        </Text>
        <Text style={{ color: "#FFFFFF", opacity: 0.8, marginTop: spacing.sm, textAlign: "center", lineHeight: 21 }}>
          Misafir olarak bu cihazda en fazla {GUEST_LIMIT} abonelik takip edebilirsin. Daha fazlası
          için hesap oluştur, ardından Premium'a geç.
        </Text>

        <View style={{ marginTop: spacing.lg, gap: spacing.sm, alignSelf: "stretch" }}>
          <Text style={{ color: "#FFFFFF", fontSize: 15 }}>• Abonelikler hesabına taşınır</Text>
          <Text style={{ color: "#FFFFFF", fontSize: 15 }}>• Zam olduğunda haber verilir</Text>
          <Text style={{ color: "#FFFFFF", fontSize: 15 }}>• Premium ile sınırsız abonelik</Text>
        </View>
      </View>

      <View style={{ gap: spacing.sm }}>
        <PillButton
          title="Hesap oluştur"
          onPress={() =>
            navigation.replace("Register", { promptMessage: PROMPT_MESSAGE, next: "Paywall" })
          }
        />
        <PillButton
          title="Giriş yap"
          variant="outline"
          onPress={() =>
            navigation.replace("Login", { promptMessage: PROMPT_MESSAGE, next: "Paywall" })
          }
        />
      </View>
    </ScrollView>
  );
}

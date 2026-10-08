import { useCallback, useRef } from "react";
import { Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { Kivirik, NoodleBackground, PillButton } from "../../components";
import { categoryIconPaths } from "../../components/icons/categoryPaths";
import { APP_NAME, SLOGAN } from "../../config/brand";
import { useAuth } from "../../context/AuthContext";
import { brandColors, categoryColors, fontFamily, nightColors, spacing, useNightStatusBar } from "../../theme";
import { useOnboarding } from "./OnboardingContext";

// Kıvırık'ın etrafında yüzen pastel servis kartları (illüstrasyon).
const FLOATING_CARDS = [
  { category: "Video/Dizi-Film", top: 6, left: 0, rotate: "-10deg" },
  { category: "Müzik", top: 0, right: 4, rotate: "9deg" },
  { category: "Yapay Zeka", top: 150, left: -6, rotate: "7deg" },
  { category: "Bulut Depolama", top: 142, right: -4, rotate: "-8deg" },
];

function FloatingCard({ category, rotate, ...position }) {
  return (
    <View
      style={{
        position: "absolute",
        ...position,
        width: 70,
        height: 80,
        borderRadius: 18,
        backgroundColor: categoryColors[category],
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        transform: [{ rotate }],
      }}
    >
      <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
        {(categoryIconPaths[category] ?? []).map((d) => (
          <Path
            key={d}
            d={d}
            stroke={brandColors.ink}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </Svg>
      <View style={{ width: 34, height: 6, borderRadius: 3, backgroundColor: brandColors.ink, opacity: 0.8 }} />
    </View>
  );
}

export default function WelcomeScreen({ navigation }) {
  const { setStep, finish } = useOnboarding();
  const { isAuthenticated, subscriptionCount } = useAuth();
  const insets = useSafeAreaInsets();
  // "Zaten hesabım var" ile giriş modalı açıldı mı? Kapanınca oturum açılmışsa
  // aboneliği olan kullanıcı doğrudan uygulamaya, olmayan servis seçimine geçer.
  const awaitingAuthRef = useRef(false);

  useNightStatusBar();

  useFocusEffect(
    useCallback(() => {
      setStep("Welcome");
      if (awaitingAuthRef.current && isAuthenticated) {
        awaitingAuthRef.current = false;
        if (subscriptionCount > 0) {
          finish(navigation);
        } else {
          navigation.navigate("SelectServices");
        }
      }
    }, [isAuthenticated, subscriptionCount])
  );

  function handleLoginPress() {
    awaitingAuthRef.current = true;
    navigation.navigate("Login");
  }

  return (
    <View style={{ flex: 1, backgroundColor: brandColors.ink }}>
      <NoodleBackground opacity={0.16} />

      <Text
        style={{
          marginTop: insets.top + spacing.md,
          textAlign: "center",
          fontFamily: fontFamily.extraBold,
          fontSize: 22,
          color: brandColors.safran,
        }}
      >
        {APP_NAME}
      </Text>

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: 340, height: 270, alignItems: "center", justifyContent: "flex-end" }}>
          {FLOATING_CARDS.map((card) => (
            <FloatingCard key={card.category} {...card} />
          ))}
          <Kivirik size={260} mood="selam" bowl="krem" />
        </View>
      </View>

      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.md }}>
        <Text
          style={{
            fontFamily: fontFamily.extraBold,
            fontSize: 38,
            lineHeight: 42,
            letterSpacing: -0.5,
            color: nightColors.text,
          }}
        >
          {SLOGAN}
        </Text>
        <Text style={{ color: nightColors.text2, fontSize: 16, lineHeight: 23, marginTop: spacing.md }}>
          Kullandığın servisleri işaretle, aylık ve yıllık harcamanı tek bakışta gör. Fiyatları
          Kıvırık takip etsin.
        </Text>

        <PillButton
          title="Başlayalım"
          variant="accent"
          onPress={() => navigation.navigate("SelectServices")}
          style={{ marginTop: spacing.lg }}
        />
        <Text
          onPress={handleLoginPress}
          accessibilityRole="link"
          style={{
            color: nightColors.text,
            fontWeight: "600",
            fontSize: 15,
            textAlign: "center",
            paddingVertical: spacing.md,
          }}
        >
          Zaten hesabım var
        </Text>
      </View>
    </View>
  );
}

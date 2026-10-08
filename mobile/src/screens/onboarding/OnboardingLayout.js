import { useCallback } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KivirikBubble, KivirikHead, PillButton } from "../../components";
import { nightColors, useNightStatusBar, useTheme } from "../../theme";
import { useOnboarding } from "./OnboardingContext";
import { ONBOARDING_STEPS } from "./steps";

// Tüm onboarding adımlarının ortak iskeleti: üstte geri butonu ve ince
// ilerleme çubuğu, altta sabit eylem alanı (footer). Ekran odaklandığında
// adım taslağa yazılır. night: sistem temasından bağımsız koyu zemin.
export function OnboardingLayout({ step, children, footer, night = false }) {
  const navigation = useNavigation();
  const { setStep } = useOnboarding();
  const theme = useTheme();
  const colors = night ? nightColors : theme.colors;
  const { spacing } = theme;
  const insets = useSafeAreaInsets();
  const index = ONBOARDING_STEPS.indexOf(step);
  const progress = (index + 1) / ONBOARDING_STEPS.length;

  useFocusEffect(
    useCallback(() => {
      setStep(step);
    }, [step])
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {night ? <NightStatusBar /> : null}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          paddingTop: insets.top + spacing.sm,
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.sm,
          minHeight: insets.top + spacing.sm + 44,
        }}
      >
        {index > 0 ? (
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Geri"
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: colors.card,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 20, color: colors.text }}>‹</Text>
          </Pressable>
        ) : null}

        <View
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 1, max: ONBOARDING_STEPS.length, now: index + 1 }}
          style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.divider }}
        >
          <View
            style={{
              width: `${progress * 100}%`,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.primary,
            }}
          />
        </View>
      </View>

      <View style={{ flex: 1 }}>{children}</View>

      {footer ? (
        <View
          style={{
            paddingHorizontal: spacing.md,
            paddingTop: spacing.sm,
            paddingBottom: insets.bottom + spacing.md,
            backgroundColor: colors.bg,
          }}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}

// Adımın sorusu: küçük Kıvırık kafası ve yanında konuşma balonu.
export function KivirikPrompt({ text, mood = "normal" }) {
  const { spacing } = useTheme();

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, marginBottom: spacing.md }}>
      <KivirikHead size={52} mood={mood} />
      <KivirikBubble text={text} tail="left" style={{ flex: 1 }} />
    </View>
  );
}

// Katalog yüklenirken/yüklenemediğinde adımların gösterdiği durum.
export function CatalogStatus({ night = false }) {
  const { catalogLoading, catalogError, reloadCatalog } = useOnboarding();
  const theme = useTheme();
  const colors = night ? nightColors : theme.colors;
  const { spacing } = theme;

  if (catalogLoading) {
    return <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} />;
  }

  if (catalogError) {
    return (
      <View style={{ padding: spacing.md, gap: spacing.md }}>
        <Text style={{ color: colors.danger, textAlign: "center" }}>{catalogError}</Text>
        <PillButton title="Tekrar dene" variant="outline" onPress={reloadCatalog} />
      </View>
    );
  }

  return null;
}

// Koşullu hook çağrısından kaçınmak için ayrı bileşen.
function NightStatusBar() {
  useNightStatusBar();
  return null;
}

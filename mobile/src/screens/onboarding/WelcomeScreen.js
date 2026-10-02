import { Text, View } from "react-native";

import { BrandIcon, PillButton } from "../../components";
import { APP_NAME, SLOGAN } from "../../config/brand";
import { fontFamily, useTheme } from "../../theme";
import { OnboardingLayout } from "./OnboardingLayout";

export default function WelcomeScreen({ navigation }) {
  const { colors, spacing, typography } = useTheme();

  return (
    <OnboardingLayout
      step="Welcome"
      footer={<PillButton title="Başla" onPress={() => navigation.navigate("SelectServices")} />}
    >
      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: spacing.lg }}>
        <BrandIcon size={88} />
        <Text
          style={{
            fontFamily: fontFamily.extraBold,
            fontSize: 20,
            letterSpacing: -0.5,
            color: colors.text2,
            marginTop: spacing.lg,
          }}
        >
          {APP_NAME}
        </Text>
        <Text style={[typography.screenTitle, { color: colors.text, marginTop: spacing.xs, lineHeight: 38 }]}>
          Aboneliklerini seç, fiyatları biz takip edelim.
        </Text>
        <Text style={{ color: colors.text2, fontSize: 16, lineHeight: 23, marginTop: spacing.md }}>
          {SLOGAN} Kullandığın servisleri işaretle, aylık ve yıllık harcamanı tek bakışta gör.
        </Text>
      </View>
    </OnboardingLayout>
  );
}

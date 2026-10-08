import { ScrollView, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { Kivirik, PillButton, ServiceLogo } from "../../components";
import { GUEST_LIMIT } from "../../storage/guestSubscriptions";
import { brandColors, fontFamily, nightColors, useTheme } from "../../theme";
import { sumMonthlyTry } from "../../utils/catalog";
import { formatTRY } from "../../utils/price";
import { CatalogStatus, OnboardingLayout } from "./OnboardingLayout";
import { useOnboarding } from "./OnboardingContext";

const ILLUSTRATION_WIDTH = 320;
const ILLUSTRATION_HEIGHT = 220;

// Kıvırık'ın etrafındaki konfeti: kare yerine küçük dalgalı erişte parçaları.
const CONFETTI = [
  { x: 22, y: 40, color: brandColors.safran, width: 6, rotate: -20 },
  { x: 70, y: 12, color: brandColors.biber, width: 5, rotate: 15 },
  { x: 250, y: 22, color: brandColors.mandalina, width: 6, rotate: -10 },
  { x: 278, y: 86, color: brandColors.safran, width: 5, rotate: 30 },
  { x: 12, y: 120, color: brandColors.mandalina, width: 5, rotate: 25 },
  { x: 40, y: 182, color: brandColors.biber, width: 6, rotate: -30 },
  { x: 262, y: 168, color: brandColors.biber, width: 5, rotate: -15 },
  { x: 200, y: 6, color: brandColors.safran, width: 5, rotate: 40 },
];

function Confetti() {
  return (
    <Svg
      width={ILLUSTRATION_WIDTH}
      height={ILLUSTRATION_HEIGHT}
      style={{ position: "absolute", top: 0, left: 0 }}
      pointerEvents="none"
    >
      {CONFETTI.map(({ x, y, color, width, rotate }) => (
        <Path
          key={`${x}-${y}`}
          d={`M${x} ${y} q 8 -14 16 0 t 16 0`}
          stroke={color}
          strokeWidth={width}
          strokeLinecap="round"
          fill="none"
          transform={`rotate(${rotate} ${x + 16} ${y})`}
        />
      ))}
    </Svg>
  );
}

export default function SummaryScreen({ navigation }) {
  const { catalogLoading, catalogError, chosenPlans } = useOnboarding();
  const { spacing, radius } = useTheme();
  const colors = nightColors;

  // USD planlar current_price_try (güncel kur) ile toplanır.
  const monthly = sumMonthlyTry(chosenPlans);
  const hasUsd = chosenPlans.some((plan) => plan.currency === "USD");

  return (
    <OnboardingLayout
      step="Summary"
      night
      footer={
        <PillButton
          title="Devam"
          variant="accent"
          disabled={chosenPlans.length === 0}
          onPress={() => navigation.navigate("Save")}
        />
      }
    >
      {catalogLoading || catalogError ? (
        <CatalogStatus night />
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.md,
            paddingBottom: spacing.md,
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: ILLUSTRATION_WIDTH,
              height: ILLUSTRATION_HEIGHT,
              alignItems: "center",
              justifyContent: "flex-end",
            }}
          >
            <Confetti />
            <Kivirik size={200} mood="sasirmis" bowl="krem" />
          </View>

          <Text
            style={{
              fontFamily: fontFamily.extraBold,
              fontSize: 24,
              color: colors.text,
              textAlign: "center",
              marginTop: spacing.lg,
            }}
          >
            Aboneliklerin sana ayda şu kadara mal oluyor
          </Text>

          <Text
            style={{
              fontFamily: fontFamily.extraBold,
              fontSize: 58,
              lineHeight: 66,
              fontVariant: ["tabular-nums"],
              color: brandColors.safran,
              marginTop: spacing.sm,
            }}
          >
            {formatTRY(monthly)}
          </Text>
          <Text style={{ color: colors.text2, fontSize: 15 }}>
            Yılda{" "}
            <Text style={{ color: colors.text, fontFamily: fontFamily.bold }}>
              {formatTRY(monthly * 12)}
            </Text>
          </Text>

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: 6,
              marginTop: spacing.lg,
            }}
          >
            {chosenPlans.map((plan) => (
              <ServiceLogo
                key={plan.catalog_id}
                domain={plan.domain}
                logoUrl={plan.logo_url}
                name={plan.app_name}
                category={plan.category}
                size={32}
              />
            ))}
          </View>

          <Text style={{ color: colors.text2, fontSize: 13, marginTop: spacing.sm, textAlign: "center" }}>
            {chosenPlans.length} abonelik.
            {hasUsd ? " Dolar planları güncel kurla hesaplandı." : ""}
          </Text>

          {chosenPlans.length > GUEST_LIMIT ? (
            <View
              style={{
                alignSelf: "stretch",
                backgroundColor: colors.accentSoft,
                borderRadius: radius.input,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
                marginTop: spacing.md,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "600", textAlign: "center" }}>
                Ücretsiz planda {GUEST_LIMIT} aboneliği takip edebilirsin.
              </Text>
            </View>
          ) : null}
        </ScrollView>
      )}
    </OnboardingLayout>
  );
}

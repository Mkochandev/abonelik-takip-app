import { ScrollView, Text, View } from "react-native";

import { Card, PillButton, ServiceLogo } from "../../components";
import { GUEST_LIMIT } from "../../storage/guestSubscriptions";
import { fontFamily, useTheme } from "../../theme";
import { sumMonthlyTry } from "../../utils/catalog";
import { formatTRY } from "../../utils/price";
import { CatalogStatus, OnboardingLayout } from "./OnboardingLayout";
import { useOnboarding } from "./OnboardingContext";

export default function SummaryScreen({ navigation }) {
  const { catalogLoading, catalogError, chosenPlans } = useOnboarding();
  const { colors, spacing, radius, typography } = useTheme();

  // USD planlar current_price_try (güncel kur) ile toplanır.
  const monthly = sumMonthlyTry(chosenPlans);
  const hasUsd = chosenPlans.some((plan) => plan.currency === "USD");

  return (
    <OnboardingLayout
      step="Summary"
      footer={
        <PillButton
          title="Devam"
          disabled={chosenPlans.length === 0}
          onPress={() => navigation.navigate("Save")}
        />
      }
    >
      {catalogLoading || catalogError ? (
        <CatalogStatus />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md }}>
          <Text style={[typography.sectionTitle, { color: colors.text, marginBottom: spacing.md }]}>
            Aboneliklerin sana şu kadara mal oluyor
          </Text>

          <Card>
            <Text style={{ color: colors.text2, fontSize: 13, fontWeight: "600" }}>Aylık toplam</Text>
            <Text style={[typography.amountLarge, { color: colors.text, marginTop: 4 }]}>
              {formatTRY(monthly)}
            </Text>

            <View style={{ height: 1, backgroundColor: colors.divider, marginVertical: spacing.md }} />

            <Text style={{ color: colors.text2, fontSize: 13, fontWeight: "600" }}>Yıllık toplam</Text>
            <Text
              style={{
                fontFamily: fontFamily.extraBold,
                fontSize: 30,
                fontVariant: ["tabular-nums"],
                color: colors.text,
                marginTop: 4,
              }}
            >
              {formatTRY(monthly * 12)}
            </Text>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: spacing.md }}>
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

            <Text style={{ color: colors.text2, fontSize: 13, marginTop: spacing.sm }}>
              {chosenPlans.length} abonelik.
              {hasUsd ? " Dolar planları güncel kurla hesaplandı." : ""}
            </Text>
          </Card>

          {chosenPlans.length > GUEST_LIMIT ? (
            <View
              style={{
                backgroundColor: colors.accentSoft,
                borderRadius: radius.input,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
                marginTop: spacing.md,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "600" }}>
                Ücretsiz planda {GUEST_LIMIT} aboneliği takip edebilirsin.
              </Text>
            </View>
          ) : null}
        </ScrollView>
      )}
    </OnboardingLayout>
  );
}

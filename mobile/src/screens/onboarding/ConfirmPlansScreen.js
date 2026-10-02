import { ScrollView, Text, View } from "react-native";

import { Card, Chip, PillButton, ServiceLogo } from "../../components";
import { useTheme } from "../../theme";
import { formatSubscriptionPrice } from "../../utils/price";
import { CatalogStatus, OnboardingLayout } from "./OnboardingLayout";
import { useOnboarding } from "./OnboardingContext";

export default function ConfirmPlansScreen({ navigation }) {
  const { catalogLoading, catalogError, selectedGroups, chosenPlans, choosePlan } = useOnboarding();
  const { colors, spacing, typography } = useTheme();

  return (
    <OnboardingLayout
      step="ConfirmPlans"
      footer={
        <PillButton
          title="Devam"
          disabled={chosenPlans.length === 0}
          onPress={() => navigation.navigate("Summary")}
        />
      }
    >
      {catalogLoading || catalogError ? (
        <CatalogStatus />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md }}>
          <Text style={[typography.sectionTitle, { color: colors.text }]}>Planlarını onayla</Text>
          <Text style={{ color: colors.text2, marginTop: spacing.xs, marginBottom: spacing.md }}>
            Her servis için en uygun plan seçili. Farklıysa değiştir.
          </Text>

          <View style={{ gap: spacing.sm }}>
            {selectedGroups.map((group, index) => {
              const chosenId = chosenPlans[index]?.catalog_id;

              return (
                <Card key={group.app_name}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                    <ServiceLogo
                      domain={group.domain}
                      logoUrl={group.logo_url}
                      name={group.app_name}
                      category={group.plans[0]?.category}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text }}>
                        {group.app_name}
                      </Text>
                      <Text style={{ fontSize: 13, color: colors.text2, marginTop: 2 }}>
                        {group.plans[0]?.category}
                      </Text>
                    </View>
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginTop: spacing.md }}
                    contentContainerStyle={{ gap: spacing.sm }}
                  >
                    {group.plans.map((plan) => (
                      <View key={plan.id} style={{ alignItems: "center" }}>
                        <Chip
                          label={plan.plan_name || "Standart"}
                          selected={plan.id === chosenId}
                          onPress={() => choosePlan(group.app_name, plan.id)}
                        />
                        <Text style={{ color: colors.text2, fontSize: 12.5, marginTop: 4 }}>
                          {formatSubscriptionPrice(plan).primary}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                </Card>
              );
            })}
          </View>
        </ScrollView>
      )}
    </OnboardingLayout>
  );
}

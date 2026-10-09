import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { BillingDayPicker, Card, Chip, PillButton, ServiceLogo } from "../../components";
import { useTheme } from "../../theme";
import { MONTH_NAMES, isYearly } from "../../utils/billing";
import { CatalogStatus, KivirikPrompt, OnboardingLayout } from "./OnboardingLayout";
import { useOnboarding } from "./OnboardingContext";
import { maybeAskForReminders } from "../../services/reminders";

function isComplete(value, yearly) {
  return Boolean(value?.day) && (!yearly || Boolean(value?.month));
}

function valueLabel(value, yearly) {
  if (value?.unknown) {
    return "Bilmiyorum";
  }
  if (!isComplete(value, yearly)) {
    return "Seç";
  }
  return yearly
    ? `${value.day} ${MONTH_NAMES[value.month - 1]}`
    : `Ayın ${value.day}. günü`;
}

// Servis ve plan seçiminden sonra: her abonelik için ödeme günü. Satıra
// dokununca gün seçici açılır; seçim bitince sıradaki boş satıra geçilir.
// Her satır "Bilmiyorum" ile, adımın tamamı "Sonra eklerim" ile geçilebilir.
export default function BillingDaysScreen({ navigation }) {
  const { catalogLoading, catalogError, chosenPlans, billingDays, setBillingDay } = useOnboarding();
  const { colors, spacing } = useTheme();
  const [openApp, setOpenApp] = useState(() => {
    const firstEmpty = chosenPlans.find((plan) => !billingDays[plan.app_name]);
    return firstEmpty?.app_name ?? null;
  });

  const answeredCount = chosenPlans.filter((plan) =>
    isComplete(billingDays[plan.app_name], isYearly(plan))
  ).length;

  // Sıradaki cevapsız satırı açar (yoksa hepsi kapanır).
  function openNextAfter(appName) {
    const start = chosenPlans.findIndex((plan) => plan.app_name === appName);
    const next = chosenPlans
      .slice(start + 1)
      .find((plan) => !billingDays[plan.app_name] && plan.app_name !== appName);
    setOpenApp(next?.app_name ?? null);
  }

  function handleChange(plan, value) {
    setBillingDay(plan.app_name, value);
    if (isComplete(value, isYearly(plan))) {
      // İlk girilen günde Kıvırık hatırlatma iznini sorar (bir kez).
      maybeAskForReminders();
      openNextAfter(plan.app_name);
    }
  }

  function handleUnknown(plan) {
    setBillingDay(plan.app_name, { unknown: true });
    openNextAfter(plan.app_name);
  }

  return (
    <OnboardingLayout
      step="BillingDays"
      footer={
        answeredCount > 0 ? (
          <PillButton title="Devam" onPress={() => navigation.navigate("Summary")} />
        ) : (
          <PillButton
            title="Sonra eklerim"
            variant="outline"
            onPress={() => navigation.navigate("Summary")}
          />
        )
      }
    >
      {catalogLoading || catalogError ? (
        <CatalogStatus />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md }}
          keyboardShouldPersistTaps="handled"
        >
          <KivirikPrompt
            mood="dusunceli"
            text="Bunların ödemesi ayın kaçında çıkıyor? Ödemeden önce sana haber vereyim."
          />

          <View style={{ gap: spacing.sm }}>
            {chosenPlans.map((plan) => {
              const yearly = isYearly(plan);
              const value = billingDays[plan.app_name];
              const isOpen = openApp === plan.app_name;
              const done = isComplete(value, yearly);

              return (
                <Card key={plan.app_name}>
                  <Pressable
                    onPress={() => setOpenApp(isOpen ? null : plan.app_name)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isOpen }}
                    accessibilityLabel={`${plan.app_name}, ödeme günü: ${valueLabel(value, yearly)}`}
                    style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}
                  >
                    <ServiceLogo
                      domain={plan.domain}
                      logoUrl={plan.logo_url}
                      name={plan.app_name}
                      category={plan.category}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text }} numberOfLines={1}>
                        {plan.app_name}
                      </Text>
                      <Text style={{ fontSize: 13, color: colors.text2, marginTop: 2 }} numberOfLines={1}>
                        {plan.plan_name ? `${plan.plan_name} · ` : ""}
                        {yearly ? "Yıllık" : "Aylık"}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontWeight: "700",
                        fontSize: 14,
                        color: done ? colors.text : colors.text2,
                      }}
                    >
                      {valueLabel(value, yearly)}
                    </Text>
                    {!isOpen ? <Text style={{ color: colors.text2, fontSize: 18 }}>›</Text> : null}
                  </Pressable>

                  {isOpen ? (
                    <View style={{ marginTop: spacing.md, gap: spacing.md }}>
                      <BillingDayPicker
                        yearly={yearly}
                        day={value?.day ?? null}
                        month={value?.month ?? null}
                        onChange={(next) => handleChange(plan, next)}
                      />
                      <Chip
                        label="Bilmiyorum"
                        selected={Boolean(value?.unknown)}
                        onPress={() => handleUnknown(plan)}
                        style={{ alignSelf: "flex-start" }}
                      />
                    </View>
                  ) : null}
                </Card>
              );
            })}
          </View>

          <Text style={{ color: colors.text2, fontSize: 13, marginTop: spacing.md, lineHeight: 19 }}>
            Bilmediklerini sonra ana sayfadan ekleyebilirsin.
          </Text>
        </ScrollView>
      )}
    </OnboardingLayout>
  );
}

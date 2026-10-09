import { useCallback, useRef, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Svg, { Path } from "react-native-svg";

import * as api from "../../api/client";
import { Card, Kivirik, PillButton, ServiceLogo } from "../../components";
import { useAuth } from "../../context/AuthContext";
import { GUEST_LIMIT, addGuestSubscriptions } from "../../storage/guestSubscriptions";
import { useTheme } from "../../theme";
import { sumMonthlyTry } from "../../utils/catalog";
import { formatTRY } from "../../utils/price";
import { CatalogStatus, OnboardingLayout } from "./OnboardingLayout";
import { useOnboarding } from "./OnboardingContext";

// Kıvırık'ın üstünde duran, onay işaretli açık mavi bulut.
function CheckCloud() {
  return (
    <Svg width={92} height={60} viewBox="0 0 92 60">
      <Path
        d="M24 56 C10 56 2 47 2 37 C2 27 10 19 21 19 C24 9 33 2 45 2 C58 2 67 11 69 22 C81 22 90 30 90 40 C90 49 82 56 71 56 Z"
        fill="#CFE5FB"
      />
      <Path
        d="M33 31 L42 40 L60 22"
        stroke="#15131A"
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

export default function SaveScreen({ navigation }) {
  const { token, isAuthenticated, refreshPlan } = useAuth();
  const { catalogLoading, catalogError, chosenPlans, finish } = useOnboarding();
  const { colors, spacing, typography } = useTheme();
  const [saving, setSaving] = useState(false);
  // "Hesap oluştur ve kaydet" ile giriş/kayıt modalı açıldı mı? Modal
  // kapanıp bu ekran yeniden odaklandığında oturum açılmışsa kayda geçilir.
  const awaitingAuthRef = useRef(false);

  const catalogIds = chosenPlans.map((plan) => plan.catalog_id);
  // Ödeme günü (girildiyse) hem hesaba hem misafir listesine gider.
  const entries = chosenPlans.map((plan) => ({
    catalog_id: plan.catalog_id,
    billing_date: plan.billing_date,
    billing_month: plan.billing_month,
  }));

  async function saveToAccount(activeToken) {
    setSaving(true);
    try {
      const result = await api.bulkAddUserSubscriptions(activeToken, entries);
      await refreshPlan(activeToken);
      // Limite takılan seçimler eklenmedi; Paywall Ana sayfanın üstünde açılır
      // ve kapatıldığında kullanıcı Ana sayfada kalır.
      await finish(navigation, result.limit_reached ? ["Paywall"] : []);
    } catch (err) {
      setSaving(false);
      Alert.alert("Kaydedilemedi", err.message);
    }
  }

  useFocusEffect(
    useCallback(() => {
      if (awaitingAuthRef.current && isAuthenticated && token) {
        awaitingAuthRef.current = false;
        saveToAccount(token);
      }
    }, [isAuthenticated, token])
  );

  function handleAccountPress() {
    if (isAuthenticated) {
      saveToAccount(token);
      return;
    }
    awaitingAuthRef.current = true;
    navigation.navigate("Register", {
      promptMessage: "Seçimlerini kaydetmek için hesap oluştur",
    });
  }

  async function handleGuestPress() {
    setSaving(true);
    // Misafir listesi en fazla GUEST_LIMIT kayıt alır; seçim sırasına göre
    // ilk 5'i eklenir.
    const { rejected } = await addGuestSubscriptions(entries).catch(() => ({ rejected: [] }));

    if (rejected.length > 0) {
      Alert.alert(
        `İlk ${GUEST_LIMIT} abonelik eklendi`,
        "Diğerleri için hesap oluşturup Premium'a geçebilirsin.",
        [{ text: "Tamam", onPress: () => finish(navigation) }],
        { cancelable: false }
      );
      return;
    }

    await finish(navigation);
  }

  return (
    <OnboardingLayout
      step="Save"
      footer={
        <View style={{ gap: spacing.sm }}>
          <PillButton
            title={isAuthenticated ? "Kaydet" : "Hesap oluştur ve kaydet"}
            onPress={handleAccountPress}
            loading={saving}
            disabled={catalogIds.length === 0}
          />
          {!isAuthenticated ? (
            <PillButton
              title="Misafir olarak devam et"
              variant="outline"
              onPress={handleGuestPress}
              disabled={saving || catalogIds.length === 0}
            />
          ) : null}
        </View>
      }
    >
      {catalogLoading || catalogError ? (
        <CatalogStatus />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md }}>
          <View style={{ alignItems: "center", marginBottom: spacing.lg }}>
            <CheckCloud />
            <Kivirik size={180} mood="mutlu" bowl="gece" />
          </View>
          <Text style={[typography.sectionTitle, { color: colors.text }]}>Seçimlerini kaydet</Text>
          <Text style={{ color: colors.text2, marginTop: spacing.xs, marginBottom: spacing.md, lineHeight: 21 }}>
            Hesap oluşturursan aboneliklerin kaybolmaz ve bir servise zam geldiğinde haber veririz.
          </Text>

          <Card>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
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
            <Text style={{ color: colors.text, fontWeight: "600", marginTop: spacing.sm }}>
              {chosenPlans.length} abonelik · aylık {formatTRY(sumMonthlyTry(chosenPlans))}
            </Text>
          </Card>
        </ScrollView>
      )}
    </OnboardingLayout>
  );
}

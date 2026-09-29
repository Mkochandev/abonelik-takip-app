import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Purchases from "react-native-purchases";

import * as api from "../api/client";
import { BrandIcon, Card, PillButton } from "../components";
import { useAuth } from "../context/AuthContext";
import { fontFamily, useTheme } from "../theme";

const TERMS_URL = "https://abonelik-api.gaziustam.com/terms.html";
const PRIVACY_URL = "https://abonelik-api.gaziustam.com/privacy.html";

function packageTitle(pkg) {
  if (pkg.packageType === "ANNUAL") return "Yıllık";
  if (pkg.packageType === "MONTHLY") return "Aylık";
  return pkg.product.title;
}

function packagePeriod(pkg) {
  if (pkg.packageType === "ANNUAL") return " / yıl";
  if (pkg.packageType === "MONTHLY") return " / ay";
  return "";
}

const PLAN_SYNC_RETRY_DELAYS_MS = [5000, 15000, 30000, 60000];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function PaywallScreen({ navigation }) {
  const { token, refreshPlan } = useAuth();
  const { colors, spacing, radius, brand } = useTheme();
  const insets = useSafeAreaInsets();

  const [loadingOfferings, setLoadingOfferings] = useState(true);
  const [packages, setPackages] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isActive = true;

    async function loadOfferings() {
      setLoadingOfferings(true);
      setError(null);
      try {
        const offerings = await Purchases.getOfferings();
        const available = offerings.current?.availablePackages || [];
        if (isActive) {
          setPackages(available);
          const annual = available.find((pkg) => pkg.packageType === "ANNUAL");
          const monthly = available.find((pkg) => pkg.packageType === "MONTHLY");
          setSelectedId((annual || monthly || available[0])?.identifier ?? null);
        }
      } catch (err) {
        if (isActive) {
          setError("Paketler yüklenemedi. Lütfen tekrar dene.");
        }
      } finally {
        if (isActive) {
          setLoadingOfferings(false);
        }
      }
    }

    loadOfferings();

    return () => {
      isActive = false;
    };
  }, []);

  const monthlyPkg = packages.find((pkg) => pkg.packageType === "MONTHLY");
  const annualPkg = packages.find((pkg) => pkg.packageType === "ANNUAL");
  const selectedPackage = packages.find((pkg) => pkg.identifier === selectedId);

  let annualSavingsPercent = null;
  if (monthlyPkg && annualPkg && monthlyPkg.product.price > 0) {
    const annualMonthlyEquivalent = annualPkg.product.price / 12;
    annualSavingsPercent = Math.round((1 - annualMonthlyEquivalent / monthlyPkg.product.price) * 100);
  }

  async function handleContinue() {
    if (!selectedPackage) {
      return;
    }
    setPurchasing(true);
    setError(null);

    try {
      await Purchases.purchasePackage(selectedPackage);
    } catch (err) {
      if (!err.userCancelled) {
        setError(err.message || "Satın alma tamamlanamadı");
      }
      setPurchasing(false);
      return;
    }

    // Satın alma tamamlandı; bundan sonraki hatalar kullanıcıya satın alma
    // hatası gibi gösterilmemeli. Plan senkronu başarısız olursa webhook
    // zaten planı yazacak, biz de arka planda tekrar deneriz.
    try {
      await api.syncPlan(token);
      const data = await refreshPlan();
      if (data?.plan !== "premium") {
        throw new Error("Plan henüz güncellenmedi");
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert("Teşekkürler", "Satın alman alındı, birkaç dakika içinde aktif olacak.");
      navigation.goBack();
      retryPlanSyncInBackground();
    } finally {
      setPurchasing(false);
    }
  }

  async function retryPlanSyncInBackground() {
    for (const delay of PLAN_SYNC_RETRY_DELAYS_MS) {
      await wait(delay);
      await api.syncPlan(token).catch(() => {});
      const data = await refreshPlan();
      if (data?.plan === "premium") {
        return;
      }
    }
  }

  async function handleRestore() {
    setRestoring(true);
    setError(null);
    try {
      await Purchases.restorePurchases();
      await api.syncPlan(token);
      await refreshPlan();
      Alert.alert("Tamamlandı", "Satın alman geri yüklendi.");
    } catch (err) {
      setError(err.message || "Geri yükleme başarısız");
    } finally {
      setRestoring(false);
    }
  }

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
        <BrandIcon size={64} />
        <Text
          style={{
            fontFamily: fontFamily.extraBold,
            fontSize: 26,
            color: "#FFFFFF",
            marginTop: spacing.md,
            textAlign: "center",
          }}
        >
          Sınırsız takip
        </Text>

        <View style={{ marginTop: spacing.lg, gap: spacing.sm, alignSelf: "stretch" }}>
          <Text style={{ color: "#FFFFFF", fontSize: 15 }}>• 5 yerine sınırsız abonelik</Text>
          <Text style={{ color: "#FFFFFF", fontSize: 15 }}>• Uygulamanın gelişimine destek</Text>
        </View>
      </View>

      {loadingOfferings ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
      ) : packages.length === 0 ? (
        <Text style={{ color: colors.danger, textAlign: "center", marginTop: spacing.lg }}>
          {error || "Şu an paket bulunamadı."}
        </Text>
      ) : (
        <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
          {[monthlyPkg, annualPkg].filter(Boolean).map((pkg) => {
            const selected = pkg.identifier === selectedId;

            return (
              <Pressable key={pkg.identifier} onPress={() => setSelectedId(pkg.identifier)}>
                <Card style={{ borderWidth: 2, borderColor: selected ? colors.primary : "transparent" }}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <View>
                      <Text style={{ fontFamily: fontFamily.bold, fontSize: 16, color: colors.text }}>
                        {packageTitle(pkg)}
                      </Text>
                      <Text style={{ color: colors.text2, marginTop: 2 }}>
                        {pkg.product.priceString}
                        {packagePeriod(pkg)}
                      </Text>
                    </View>

                    {pkg.packageType === "ANNUAL" && annualSavingsPercent > 0 ? (
                      <View
                        style={{
                          backgroundColor: brand.safran,
                          borderRadius: 999,
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: "700", color: brand.ink }}>
                          %{annualSavingsPercent} tasarruf
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </View>
      )}

      {error ? (
        <Text style={{ color: colors.danger, textAlign: "center", marginTop: spacing.md }}>{error}</Text>
      ) : null}

      <View style={{ marginTop: spacing.lg }}>
        <PillButton
          title="Devam et"
          onPress={handleContinue}
          loading={purchasing}
          disabled={!selectedPackage || loadingOfferings}
        />
      </View>

      <Pressable
        onPress={handleRestore}
        disabled={restoring}
        style={{ marginTop: spacing.md, alignItems: "center" }}
      >
        <Text style={{ color: colors.text, fontWeight: "600" }}>
          {restoring ? "Geri yükleniyor..." : "Satın almaları geri yükle"}
        </Text>
      </Pressable>

      <Text
        style={{
          color: colors.text2,
          fontSize: 12,
          textAlign: "center",
          marginTop: spacing.lg,
          lineHeight: 17,
        }}
      >
        Abonelik, dönem bitmeden en az 24 saat önce iptal edilmezse otomatik yenilenir. Apple
        Kimliği ayarlarından yönetebilir ve iptal edebilirsin.
      </Text>

      <View style={{ flexDirection: "row", justifyContent: "center", gap: spacing.md, marginTop: spacing.sm }}>
        <Text
          onPress={() => Linking.openURL(TERMS_URL)}
          style={{ color: colors.text2, fontSize: 12, textDecorationLine: "underline" }}
        >
          Kullanım Koşulları
        </Text>
        <Text
          onPress={() => Linking.openURL(PRIVACY_URL)}
          style={{ color: colors.text2, fontSize: 12, textDecorationLine: "underline" }}
        >
          Gizlilik Politikası
        </Text>
      </View>
    </ScrollView>
  );
}

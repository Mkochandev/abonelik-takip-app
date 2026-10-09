import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as api from "../api/client";
import { AddSubscriptionSheet, Card, Chip, SearchField, ServiceLogo, useToast } from "../components";
import { CATEGORIES } from "../config/categories";
import { useAuth } from "../context/AuthContext";
import {
  GUEST_LIMIT,
  addGuestSubscription,
  getGuestSubscriptions,
  removeGuestSubscription,
} from "../storage/guestSubscriptions";
import { fontFamily, useTheme } from "../theme";
import { isYearly } from "../utils/billing";
import { formatSubscriptionPrice } from "../utils/price";

export default function CatalogScreen({ navigation }) {
  const { token, isAuthenticated, plan: userPlan, limit } = useAuth();
  const { colors, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, showToast] = useToast();
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedApp, setExpandedApp] = useState(null);
  // catalog_id -> o kaydın user_subscriptions.id'si (henüz seçilmemişse yok).
  // Misafirde değer catalog_id'nin kendisidir (yerel listede ayrı id yok).
  const [selections, setSelections] = useState({});
  const [pendingPlanId, setPendingPlanId] = useState(null);
  const [reasonPlan, setReasonPlan] = useState(null);
  const [pendingPaywallPlan, setPendingPaywallPlan] = useState(null);

  useEffect(() => {
    const searchTerm = query.trim();
    const timeoutId = setTimeout(() => {
      fetchCatalog(searchTerm);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, selectedCategory]);

  // Seçim durumu her odaklanmada tazelenir: misafir listesi onboarding ya da
  // hesaba aktarım ile, sunucu listesi giriş/çıkışla değişmiş olabilir.
  useFocusEffect(
    useCallback(() => {
      if (token) {
        fetchMySubscriptions();
      } else {
        loadGuestSelections();
      }
    }, [token])
  );

  // Paywall'dan premium olarak dönüldüğünde, sınıra takıldığı için
  // yarım kalan seçim akışını kaldığı yerden devam ettirir.
  useEffect(() => {
    if (userPlan === "premium" && pendingPaywallPlan) {
      startReasonFlow(pendingPaywallPlan);
      setPendingPaywallPlan(null);
    }
  }, [userPlan]);

  async function fetchCatalog(searchTerm) {
    setLoading(true);
    setError(null);
    try {
      const data = searchTerm
        ? await api.searchCatalog(searchTerm, selectedCategory)
        : await api.getCatalog(selectedCategory);
      setCatalog(data.catalog);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchMySubscriptions() {
    try {
      const data = await api.getUserSubscriptions(token);
      const next = {};
      for (const sub of data.subscriptions) {
        next[sub.catalog_id] = sub.id;
      }
      setSelections(next);
    } catch (err) {
      // Seçim durumu yüklenemese bile katalog kullanılabilir kalsın.
    }
  }

  async function loadGuestSelections() {
    const items = await getGuestSubscriptions();
    setSelections(Object.fromEntries(items.map((item) => [item.catalog_id, item.catalog_id])));
  }

  function toggleApp(appName) {
    setExpandedApp((current) => (current === appName ? null : appName));
  }

  function startReasonFlow(plan) {
    setReasonPlan(plan);
  }

  function handleSelectPress(appName, plan) {
    const existingSubscriptionId = selections[plan.id];

    if (existingSubscriptionId) {
      removePlan(plan, existingSubscriptionId);
      return;
    }

    if (!isAuthenticated && Object.keys(selections).length >= GUEST_LIMIT) {
      navigation.navigate("GuestLimit");
      return;
    }

    if (
      isAuthenticated &&
      userPlan === "free" &&
      limit != null &&
      Object.keys(selections).length >= limit
    ) {
      setPendingPaywallPlan({ ...plan, app_name: appName });
      navigation.navigate("Paywall");
      return;
    }

    startReasonFlow({ ...plan, app_name: appName });
  }

  async function removePlan(plan, subscriptionId) {
    setPendingPlanId(plan.id);
    try {
      if (isAuthenticated) {
        await api.removeUserSubscription(token, subscriptionId);
      } else {
        await removeGuestSubscription(plan.id);
      }
      setSelections((current) => {
        const next = { ...current };
        delete next[plan.id];
        return next;
      });
    } catch (err) {
      Alert.alert("Hata", err.message);
    } finally {
      setPendingPlanId(null);
    }
  }

  async function submitPlan(plan, details) {
    setReasonPlan(null);
    setPendingPlanId(plan.id);

    try {
      const created = await api.addUserSubscription(token, plan.id, details);
      setSelections((current) => ({ ...current, [plan.id]: created.id }));
    } catch (err) {
      if (err.code === "LIMIT_REACHED") {
        setPendingPaywallPlan(plan);
        navigation.navigate("Paywall");
      } else {
        Alert.alert("Hata", err.message);
      }
    } finally {
      setPendingPlanId(null);
    }
  }

  // Misafir: plan yalnızca bu cihazdaki listeye, ödeme günüyle eklenir.
  async function addGuestPlan(details) {
    const plan = reasonPlan;
    if (!plan) {
      return;
    }
    setReasonPlan(null);

    try {
      const result = await addGuestSubscription({
        catalog_id: plan.id,
        billing_date: details.billing_date,
        billing_month: details.billing_month,
      });
      if (result.reason === "limit") {
        navigation.navigate("GuestLimit");
        return;
      }
      setSelections((current) => ({ ...current, [plan.id]: plan.id }));
      showToast(`${plan.app_name} eklendi`);
    } catch (err) {
      Alert.alert("Hata", err.message);
    }
  }

  function handleCreateAccountPress() {
    setReasonPlan(null);
    navigation.navigate("Register", {
      promptMessage: "Cevaplarını saklamak için hesap oluştur",
    });
  }

  // Kıvırık'ın sorduğu ekleme sayfası bitti. Misafirde yalnızca ödeme günü
  // saklanır; neden ve kullanım sıklığı hesap gerektirir.
  function handleSheetSubmit(details) {
    const plan = reasonPlan;
    if (!plan) {
      return;
    }

    if (!isAuthenticated) {
      addGuestPlan(details);
      return;
    }

    // price_alert_enabled gönderilmez; sunucudaki varsayılan geçerli kalır.
    submitPlan(plan, details);
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        padding: spacing.md,
        paddingTop: insets.top + spacing.sm,
      }}
    >
      <Text style={[typography.screenTitle, { color: colors.text, marginBottom: spacing.md }]}>
        Katalog
      </Text>

      <SearchField value={query} onChangeText={setQuery} style={{ marginBottom: spacing.md }} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.md }}
      >
        <Chip
          label="Tümü"
          selected={selectedCategory === null}
          onPress={() => setSelectedCategory(null)}
        />
        {CATEGORIES.map((category) => (
          <Chip
            key={category}
            label={category}
            selected={selectedCategory === category}
            onPress={() => setSelectedCategory(category)}
          />
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator style={{ marginTop: spacing.xl }} size="large" color={colors.primary} />
      ) : error ? (
        <Text style={{ color: colors.danger, textAlign: "center", marginTop: spacing.xl }}>
          {error}
        </Text>
      ) : (
        <FlatList
          data={catalog}
          keyExtractor={(item) => item.app_name}
          contentContainerStyle={{ paddingBottom: 120, gap: spacing.sm }}
          ListEmptyComponent={
            <Text style={{ textAlign: "center", color: colors.text2, marginTop: spacing.xl }}>
              Kıvırık bu kâsede bulamadı. Başka bir ad ya da kategori dene.
            </Text>
          }
          ListFooterComponent={
            <Text
              onPress={() => Linking.openURL("https://logo.dev")}
              style={{
                color: colors.text2,
                fontSize: 11,
                textAlign: "center",
                opacity: 0.7,
                marginTop: spacing.sm,
              }}
            >
              Logolar: Logo.dev
            </Text>
          }
          renderItem={({ item }) => {
            const isExpanded = expandedApp === item.app_name;

            return (
              <Card noPadding>
                <Pressable
                  onPress={() => toggleApp(item.app_name)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: spacing.md,
                    gap: spacing.sm,
                  }}
                >
                  <ServiceLogo
                    domain={item.domain}
                    logoUrl={item.logo_url}
                    name={item.app_name}
                    category={item.plans[0]?.category}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text }}>
                      {item.app_name}
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.text2, marginTop: 2 }}>
                      {item.plans[0]?.category}
                    </Text>
                  </View>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      borderWidth: 1.5,
                      borderColor: colors.text,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 18, color: colors.text, lineHeight: 20 }}>
                      {isExpanded ? "−" : "+"}
                    </Text>
                  </View>
                </Pressable>

                {isExpanded && (
                  <View>
                    {item.plans.map((plan) => {
                      const isSelected = Boolean(selections[plan.id]);
                      const isPending = pendingPlanId === plan.id;
                      const price = formatSubscriptionPrice(plan);

                      return (
                        <View key={plan.id}>
                          <View style={{ height: 1, backgroundColor: colors.divider }} />
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: spacing.md,
                            }}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 15, fontWeight: "500", color: colors.text }}>
                                {plan.plan_name}
                              </Text>
                              <Text
                                style={{
                                  fontFamily: fontFamily.bold,
                                  fontSize: 15,
                                  color: colors.text,
                                  marginTop: 2,
                                }}
                              >
                                {price.primary}
                                {isYearly(plan) ? " / yıl" : ""}
                              </Text>
                              {price.secondary ? (
                                <Text style={{ fontSize: 13, color: colors.text2, marginTop: 2 }}>
                                  {price.secondary}
                                </Text>
                              ) : null}
                            </View>

                            {isPending ? (
                              <ActivityIndicator size="small" color={colors.primary} />
                            ) : (
                              <Chip
                                label={isSelected ? "Seçildi ✓" : "Seç"}
                                selected={isSelected}
                                onPress={() => handleSelectPress(item.app_name, plan)}
                              />
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </Card>
            );
          }}
        />
      )}

      <AddSubscriptionSheet
        plan={reasonPlan}
        isGuest={!isAuthenticated}
        onClose={() => setReasonPlan(null)}
        onSubmit={handleSheetSubmit}
        onCreateAccount={handleCreateAccountPress}
      />

      {toast}
    </View>
  );
}

import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Svg, { Circle, Line } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as api from "../api/client";
import { Card, Chip, PillButton, ServiceLogo, Toggle } from "../components";
import { useAuth } from "../context/AuthContext";
import { fontFamily, useTheme } from "../theme";
import { formatSubscriptionPrice } from "../utils/price";

const CATEGORIES = [
  "Video/Dizi-Film",
  "Müzik",
  "Kitap/Sesli Kitap",
  "Yapay Zeka",
  "Bulut Depolama",
  "Üretkenlik/Tasarım",
  "Spor",
];

const REASON_OPTIONS = {
  "Video/Dizi-Film": [
    "Belirli bir dizi/film için",
    "Genel eğlence takibi",
    "Aile/ev arkadaşıyla ortak",
    "Spor/belgesel içerikleri",
  ],
  Müzik: ["Günlük müzik dinleme", "Playlist/podcast takibi", "Reklamsız dinleme", "Offline indirme"],
  "Kitap/Sesli Kitap": [
    "Belirli bir kitap/seri için",
    "Düzenli okuma alışkanlığı",
    "Yolda/işte dinleme",
  ],
  "Yapay Zeka": ["İş/proje için", "Kod yazarken yardım", "Öğrenme/araştırma", "Kişisel kullanım"],
  "Bulut Depolama": [
    "Fotoğraf/video yedekleme",
    "Cihazlar arası senkronizasyon",
    "İş dosyaları için",
  ],
  "Üretkenlik/Tasarım": ["İş projeleri için", "Freelance/müşteri işleri", "Kişisel hobi", "Okul/eğitim"],
  Spor: ["Maç takibi", "Belirli bir takım/lig için", "Genel spor içerikleri"],
};

const USAGE_FREQUENCIES = ["Her gün", "Haftada birkaç", "Nadiren"];

function SearchIcon({ color }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={10} cy={10} r={7} stroke={color} strokeWidth={1.8} />
      <Line x1={15} y1={15} x2={21} y2={21} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export default function CatalogScreen({ navigation }) {
  const { token, isAuthenticated, plan: userPlan, limit } = useAuth();
  const { colors, spacing, radius, typography, pillRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedApp, setExpandedApp] = useState(null);
  // catalog_id -> o kaydın user_subscriptions.id'si (henüz seçilmemişse yok)
  const [selections, setSelections] = useState({});
  const [pendingPlanId, setPendingPlanId] = useState(null);
  const [reasonPlan, setReasonPlan] = useState(null);
  const [selectedChip, setSelectedChip] = useState(null);
  const [reasonText, setReasonText] = useState("");
  const [usageFrequency, setUsageFrequency] = useState(null);
  const [billingDate, setBillingDate] = useState("");
  const [priceAlertEnabled, setPriceAlertEnabled] = useState(true);
  const [pendingAuthPlan, setPendingAuthPlan] = useState(null);
  const [pendingPaywallPlan, setPendingPaywallPlan] = useState(null);

  useEffect(() => {
    const searchTerm = query.trim();
    const timeoutId = setTimeout(() => {
      fetchCatalog(searchTerm);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, selectedCategory]);

  useEffect(() => {
    if (!token) {
      setSelections({});
      return;
    }
    fetchMySubscriptions();
  }, [token]);

  // Misafir "Seç"e basıp giriş/kayıt olduğunda, bıraktığı yerden devam
  // etsin diye seçtiği planı hatırlıyoruz ve giriş tamamlanınca neden
  // penceresini otomatik açıyoruz.
  useEffect(() => {
    if (isAuthenticated && pendingAuthPlan) {
      startReasonFlow(pendingAuthPlan);
      setPendingAuthPlan(null);
    }
  }, [isAuthenticated]);

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

  function toggleApp(appName) {
    setExpandedApp((current) => (current === appName ? null : appName));
  }

  function startReasonFlow(plan) {
    setReasonPlan(plan);
    setSelectedChip(null);
    setReasonText("");
    setUsageFrequency(null);
    setBillingDate("");
    setPriceAlertEnabled(true);
  }

  function handleSelectPress(appName, plan) {
    const existingSubscriptionId = selections[plan.id];

    if (existingSubscriptionId) {
      removePlan(plan, existingSubscriptionId);
      return;
    }

    if (!isAuthenticated) {
      setPendingAuthPlan({ ...plan, app_name: appName });
      navigation.navigate("Login", { promptMessage: "Aboneliğini eklemek için giriş yap" });
      return;
    }

    if (userPlan === "free" && limit != null && Object.keys(selections).length >= limit) {
      setPendingPaywallPlan({ ...plan, app_name: appName });
      navigation.navigate("Paywall");
      return;
    }

    startReasonFlow({ ...plan, app_name: appName });
  }

  async function removePlan(plan, subscriptionId) {
    setPendingPlanId(plan.id);
    try {
      await api.removeUserSubscription(token, subscriptionId);
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

  function handleSave() {
    const plan = reasonPlan;
    if (!plan) {
      return;
    }

    const trimmedBillingDate = billingDate.trim();
    let parsedBillingDate = null;

    if (trimmedBillingDate) {
      parsedBillingDate = Number(trimmedBillingDate);
      if (!Number.isInteger(parsedBillingDate) || parsedBillingDate < 1 || parsedBillingDate > 31) {
        Alert.alert("Hata", "Fatura günü 1 ile 31 arasında olmalı");
        return;
      }
    }

    submitPlan(plan, {
      reason: reasonText.trim() || null,
      usage_frequency: usageFrequency,
      billing_date: parsedBillingDate,
      price_alert_enabled: priceAlertEnabled,
    });
  }

  function handleSkip() {
    const plan = reasonPlan;
    if (!plan) {
      return;
    }

    submitPlan(plan, {
      reason: null,
      usage_frequency: null,
      billing_date: null,
      price_alert_enabled: true,
    });
  }

  function handleChipPress(label) {
    if (selectedChip === label) {
      setSelectedChip(null);
      setReasonText((current) => (current === label ? "" : current));
    } else {
      setSelectedChip(label);
      setReasonText(label);
    }
  }

  function handleReasonTextChange(text) {
    setReasonText(text);
    if (selectedChip && text !== selectedChip) {
      setSelectedChip(null);
    }
  }

  function handleUsageFrequencyPress(label) {
    setUsageFrequency((current) => (current === label ? null : label));
  }

  function handleBillingDateChange(text) {
    setBillingDate(text.replace(/[^0-9]/g, "").slice(0, 2));
  }

  const reasonOptions = reasonPlan ? REASON_OPTIONS[reasonPlan.category] || [] : [];
  const reasonPrice = reasonPlan ? formatSubscriptionPrice(reasonPlan) : null;

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

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          height: 52,
          backgroundColor: colors.card,
          borderRadius: pillRadius(52),
          paddingHorizontal: spacing.md,
          gap: spacing.sm,
          marginBottom: spacing.md,
        }}
      >
        <SearchIcon color={colors.text2} />
        <TextInput
          style={{ flex: 1, fontSize: 16, color: colors.text }}
          placeholder="Uygulama ara..."
          placeholderTextColor={colors.text2}
          autoCapitalize="none"
          value={query}
          onChangeText={setQuery}
        />
      </View>

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
              Sonuç bulunamadı
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

      <Modal
        visible={reasonPlan !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setReasonPlan(null)}
      >
        <View style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: "flex-end" }}>
          <Pressable style={{ flex: 1 }} onPress={() => setReasonPlan(null)} />

          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: radius.sheet,
              borderTopRightRadius: radius.sheet,
              padding: spacing.lg,
              maxHeight: "88%",
            }}
          >
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.divider,
                alignSelf: "center",
                marginBottom: spacing.md,
              }}
            />

            {reasonPlan && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                  marginBottom: spacing.lg,
                }}
              >
                <ServiceLogo
                  domain={reasonPlan.domain}
                  logoUrl={reasonPlan.logo_url}
                  name={reasonPlan.app_name}
                  category={reasonPlan.category}
                  size={52}
                />
                <View>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
                    {reasonPlan.app_name} {reasonPlan.plan_name}
                  </Text>
                  <Text
                    style={{
                      fontFamily: fontFamily.bold,
                      fontSize: 15,
                      color: colors.text,
                      marginTop: 2,
                    }}
                  >
                    {reasonPrice.primary} / ay
                  </Text>
                  {reasonPrice.secondary ? (
                    <Text style={{ fontSize: 13, color: colors.text2, marginTop: 2 }}>
                      {reasonPrice.secondary}
                    </Text>
                  ) : null}
                </View>
              </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={{ fontFamily: fontFamily.extraBold, fontSize: 22, color: colors.text }}>
                Bu aboneliğe neden sahipsin?
              </Text>
              <Text style={{ color: colors.text2, marginTop: 4, marginBottom: spacing.md }}>
                İsteğe bağlı
              </Text>

              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: spacing.sm,
                  marginBottom: spacing.md,
                }}
              >
                {reasonOptions.map((label) => (
                  <Chip
                    key={label}
                    label={label}
                    selected={selectedChip === label}
                    onPress={() => handleChipPress(label)}
                  />
                ))}
              </View>

              <TextInput
                style={{
                  backgroundColor: colors.field,
                  borderRadius: radius.input,
                  padding: spacing.sm + 4,
                  fontSize: 15,
                  color: colors.text,
                  minHeight: 52,
                  textAlignVertical: "top",
                  marginBottom: spacing.lg,
                }}
                placeholder="Ya da kendi cevabını yaz..."
                placeholderTextColor={colors.text2}
                value={reasonText}
                onChangeText={handleReasonTextChange}
                multiline
              />

              <Text
                style={{
                  fontFamily: fontFamily.bold,
                  fontSize: 16,
                  color: colors.text,
                  marginBottom: spacing.sm,
                }}
              >
                Ne sıklıkla kullanıyorsun?
              </Text>
              <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg }}>
                {USAGE_FREQUENCIES.map((label) => (
                  <Chip
                    key={label}
                    label={label}
                    selected={usageFrequency === label}
                    onPress={() => handleUsageFrequencyPress(label)}
                    style={{ flex: 1 }}
                  />
                ))}
              </View>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: spacing.lg,
                }}
              >
                <Text
                  style={{ fontFamily: fontFamily.bold, fontSize: 16, color: colors.text }}
                >
                  Ödeme günü
                </Text>
                <TextInput
                  style={{
                    width: 76,
                    height: 52,
                    backgroundColor: colors.field,
                    borderRadius: radius.input,
                    textAlign: "center",
                    fontSize: 18,
                    fontWeight: "700",
                    color: colors.text,
                  }}
                  placeholder="—"
                  placeholderTextColor={colors.text2}
                  keyboardType="number-pad"
                  value={billingDate}
                  onChangeText={handleBillingDateChange}
                />
              </View>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: spacing.lg,
                }}
              >
                <Text
                  style={{ fontFamily: fontFamily.bold, fontSize: 16, color: colors.text }}
                >
                  Zam olursa haber ver
                </Text>
                <Toggle value={priceAlertEnabled} onValueChange={setPriceAlertEnabled} />
              </View>
            </ScrollView>

            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <PillButton title="Geç" variant="outline" onPress={handleSkip} style={{ flex: 1 }} />
              <PillButton title="Kaydet" onPress={handleSave} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

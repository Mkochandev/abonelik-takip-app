import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import * as api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../theme";

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

export default function CatalogScreen() {
  const { token } = useAuth();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
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

  useEffect(() => {
    const searchTerm = query.trim();
    const timeoutId = setTimeout(() => {
      fetchCatalog(searchTerm);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, selectedCategory]);

  useEffect(() => {
    fetchMySubscriptions();
  }, []);

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

  function handleSelectPress(plan) {
    const existingSubscriptionId = selections[plan.id];

    if (existingSubscriptionId) {
      removePlan(plan, existingSubscriptionId);
    } else {
      setReasonPlan(plan);
      setSelectedChip(null);
      setReasonText("");
      setUsageFrequency(null);
      setBillingDate("");
      setPriceAlertEnabled(true);
    }
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
      Alert.alert("Hata", err.message);
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Abonelik Kataloğu</Text>

      <TextInput
        style={styles.searchInput}
        placeholder="Uygulama ara..."
        placeholderTextColor={theme.colors.textSecondary}
        autoCapitalize="none"
        value={query}
        onChangeText={setQuery}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsContainer}
      >
        <TouchableOpacity
          style={[styles.chip, selectedCategory === null && styles.chipActive]}
          onPress={() => setSelectedCategory(null)}
        >
          <Text style={[styles.chipText, selectedCategory === null && styles.chipTextActive]}>
            Tümü
          </Text>
        </TouchableOpacity>

        {CATEGORIES.map((category) => {
          const isActive = selectedCategory === category;

          return (
            <TouchableOpacity
              key={category}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{category}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <ActivityIndicator style={styles.loading} size="large" color={theme.colors.accent} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <FlatList
          data={catalog}
          keyExtractor={(item) => item.app_name}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.empty}>Sonuç bulunamadı</Text>}
          renderItem={({ item }) => {
            const isExpanded = expandedApp === item.app_name;

            return (
              <View style={styles.card}>
                <TouchableOpacity
                  style={styles.cardHeader}
                  onPress={() => toggleApp(item.app_name)}
                >
                  <Text style={styles.cardTitle}>{item.app_name}</Text>
                  <Text style={styles.cardChevron}>{isExpanded ? "–" : "+"}</Text>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.plansContainer}>
                    {item.plans.map((plan) => {
                      const isSelected = Boolean(selections[plan.id]);
                      const isPending = pendingPlanId === plan.id;

                      return (
                        <View key={plan.id} style={styles.planRow}>
                          <View style={styles.planInfo}>
                            <Text style={styles.planName}>{plan.plan_name}</Text>
                            <Text style={styles.planPrice}>
                              {plan.current_price} {plan.currency}
                            </Text>
                          </View>

                          <TouchableOpacity
                            style={[styles.selectButton, isSelected && styles.selectButtonActive]}
                            onPress={() => handleSelectPress(plan)}
                            disabled={isPending}
                          >
                            {isPending ? (
                              <ActivityIndicator
                                size="small"
                                color={isSelected ? theme.colors.accentText : theme.colors.accent}
                              />
                            ) : (
                              <Text
                                style={[
                                  styles.selectButtonText,
                                  isSelected && styles.selectButtonTextActive,
                                ]}
                              >
                                {isSelected ? "Seçildi ✓" : "Seç"}
                              </Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      <Modal
        visible={reasonPlan !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setReasonPlan(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Bu aboneliğe neden sahipsin?</Text>
            <Text style={styles.modalSubtitle}>İsteğe bağlı</Text>

            <ScrollView style={styles.modalScroll}>
              <View style={styles.modalChips}>
                {reasonOptions.map((label) => {
                  const isActive = selectedChip === label;

                  return (
                    <TouchableOpacity
                      key={label}
                      style={[styles.modalChip, isActive && styles.chipActive]}
                      onPress={() => handleChipPress(label)}
                    >
                      <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TextInput
                style={styles.modalInput}
                placeholder="Ya da kendi cevabını yaz..."
                placeholderTextColor={theme.colors.textSecondary}
                value={reasonText}
                onChangeText={handleReasonTextChange}
                multiline
              />

              <Text style={styles.modalSectionTitle}>Ne sıklıkla kullanıyorsun?</Text>
              <View style={styles.modalChips}>
                {USAGE_FREQUENCIES.map((label) => {
                  const isActive = usageFrequency === label;

                  return (
                    <TouchableOpacity
                      key={label}
                      style={[styles.modalChip, isActive && styles.chipActive]}
                      onPress={() => handleUsageFrequencyPress(label)}
                    >
                      <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.modalSectionTitle}>Hangi gün ödeme yapılıyor?</Text>
              <TextInput
                style={styles.modalDateInput}
                placeholder="Örn. 15"
                placeholderTextColor={theme.colors.textSecondary}
                keyboardType="number-pad"
                value={billingDate}
                onChangeText={handleBillingDateChange}
              />

              <View style={styles.modalSwitchRow}>
                <Text style={styles.modalSwitchLabel}>Zam olursa haber ver</Text>
                <Switch
                  value={priceAlertEnabled}
                  onValueChange={setPriceAlertEnabled}
                  trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
                  thumbColor={theme.colors.background}
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSkipButton} onPress={handleSkip}>
                <Text style={styles.modalSkipButtonText}>Geç</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalSaveButton} onPress={handleSave}>
                <Text style={styles.modalSaveButtonText}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(theme) {
  const { colors, spacing, radius } = theme;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: spacing.lg,
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: colors.text,
      marginBottom: spacing.md,
    },
    searchInput: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingVertical: spacing.sm + 2,
      fontSize: 16,
      color: colors.text,
      marginBottom: spacing.md,
    },
    chipsContainer: {
      gap: spacing.sm,
      paddingBottom: spacing.md,
    },
    chip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius,
      paddingVertical: spacing.xs + 2,
      paddingHorizontal: spacing.md - 2,
      backgroundColor: colors.background,
    },
    chipActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    chipText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: "500",
    },
    chipTextActive: {
      color: colors.accentText,
    },
    loading: {
      marginTop: spacing.xl,
    },
    error: {
      color: colors.error,
      textAlign: "center",
      marginTop: spacing.xl,
    },
    empty: {
      textAlign: "center",
      color: colors.textSecondary,
      marginTop: spacing.xl,
    },
    listContent: {
      paddingBottom: spacing.lg,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
    },
    cardChevron: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    plansContainer: {
      marginTop: spacing.md,
      gap: spacing.sm + 2,
    },
    planRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: spacing.sm + 2,
    },
    planInfo: {
      flex: 1,
      marginRight: spacing.md,
    },
    planName: {
      fontSize: 15,
      fontWeight: "500",
      color: colors.text,
    },
    planPrice: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    selectButton: {
      borderWidth: 1,
      borderColor: colors.accent,
      borderRadius: radius,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md - 2,
    },
    selectButtonActive: {
      backgroundColor: colors.accent,
    },
    selectButtonText: {
      color: colors.accent,
      fontWeight: "600",
      fontSize: 13,
    },
    selectButtonTextActive: {
      color: colors.accentText,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      padding: spacing.lg,
    },
    modalCard: {
      backgroundColor: colors.background,
      borderRadius: radius,
      padding: spacing.lg,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
    },
    modalSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: spacing.xs,
      marginBottom: spacing.md,
    },
    modalScroll: {
      maxHeight: 420,
    },
    modalSectionTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
      marginBottom: spacing.sm,
    },
    modalChips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    modalChip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius,
      paddingVertical: spacing.xs + 2,
      paddingHorizontal: spacing.md - 2,
      backgroundColor: colors.background,
    },
    modalInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius,
      padding: spacing.sm + 4,
      fontSize: 15,
      color: colors.text,
      minHeight: 44,
      textAlignVertical: "top",
      marginBottom: spacing.lg,
    },
    modalDateInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius,
      padding: spacing.sm + 4,
      fontSize: 15,
      color: colors.text,
      width: 80,
      marginBottom: spacing.lg,
    },
    modalSwitchRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.md,
    },
    modalSwitchLabel: {
      fontSize: 15,
      color: colors.text,
      fontWeight: "500",
    },
    modalActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: spacing.sm,
    },
    modalSkipButton: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.md,
    },
    modalSkipButtonText: {
      color: colors.text,
      fontWeight: "600",
      fontSize: 14,
    },
    modalSaveButton: {
      backgroundColor: colors.accent,
      borderRadius: radius,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.md,
    },
    modalSaveButtonText: {
      color: colors.accentText,
      fontWeight: "600",
      fontSize: 14,
    },
  });
}

import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
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

  async function toggleSelectPlan(plan) {
    const existingSubscriptionId = selections[plan.id];
    setPendingPlanId(plan.id);

    try {
      if (existingSubscriptionId) {
        await api.removeUserSubscription(token, existingSubscriptionId);
        setSelections((current) => {
          const next = { ...current };
          delete next[plan.id];
          return next;
        });
      } else {
        const created = await api.addUserSubscription(token, plan.id);
        setSelections((current) => ({ ...current, [plan.id]: created.id }));
      }
    } catch (err) {
      Alert.alert("Hata", err.message);
    } finally {
      setPendingPlanId(null);
    }
  }

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
                            onPress={() => toggleSelectPlan(plan)}
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
                                {isSelected ? "Kaldır" : "Seç"}
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
  });
}

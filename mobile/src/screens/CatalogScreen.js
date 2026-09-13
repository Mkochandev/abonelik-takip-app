import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import * as api from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function CatalogScreen() {
  const { token } = useAuth();
  const [query, setQuery] = useState("");
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
  }, [query]);

  useEffect(() => {
    fetchMySubscriptions();
  }, []);

  async function fetchCatalog(searchTerm) {
    setLoading(true);
    setError(null);
    try {
      const data = searchTerm ? await api.searchCatalog(searchTerm) : await api.getCatalog();
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
        autoCapitalize="none"
        value={query}
        onChangeText={setQuery}
      />

      {loading ? (
        <ActivityIndicator style={styles.loading} size="large" />
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
                <TouchableOpacity onPress={() => toggleApp(item.app_name)}>
                  <Text style={styles.cardTitle}>{item.app_name}</Text>
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
                                color={isSelected ? "#fff" : "#2563eb"}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 16,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  loading: {
    marginTop: 32,
  },
  error: {
    color: "#dc2626",
    textAlign: "center",
    marginTop: 32,
  },
  empty: {
    textAlign: "center",
    color: "#666",
    marginTop: 32,
  },
  listContent: {
    paddingBottom: 24,
  },
  card: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    backgroundColor: "#fafafa",
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  plansContainer: {
    marginTop: 12,
    gap: 10,
  },
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 10,
  },
  planInfo: {
    flex: 1,
    marginRight: 12,
  },
  planName: {
    fontSize: 15,
    fontWeight: "500",
  },
  planPrice: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  selectButton: {
    borderWidth: 1,
    borderColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  selectButtonActive: {
    backgroundColor: "#2563eb",
  },
  selectButtonText: {
    color: "#2563eb",
    fontWeight: "600",
    fontSize: 14,
  },
  selectButtonTextActive: {
    color: "#fff",
  },
});

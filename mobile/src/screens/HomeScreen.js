import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import * as api from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function HomeScreen({ navigation }) {
  const { user, token, logout } = useAuth();
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function fetchSubscriptions() {
        setLoading(true);
        setError(null);
        try {
          const data = await api.getUserSubscriptions(token);
          if (isActive) {
            setSubscriptions(data.subscriptions);
          }
        } catch (err) {
          if (isActive) {
            setError(err.message);
          }
        } finally {
          if (isActive) {
            setLoading(false);
          }
        }
      }

      fetchSubscriptions();

      return () => {
        isActive = false;
      };
    }, [token])
  );

  const totalsByCurrency = subscriptions.reduce((totals, sub) => {
    const amount = Number(sub.current_price);
    totals[sub.currency] = (totals[sub.currency] || 0) + amount;
    return totals;
  }, {});

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hoş geldin, {user?.email}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Seçtiğim Abonelikler</Text>

        {loading ? (
          <ActivityIndicator style={styles.loading} />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <>
            <FlatList
              data={subscriptions}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              ListEmptyComponent={
                <Text style={styles.empty}>Henüz bir abonelik seçmedin</Text>
              }
              renderItem={({ item }) => (
                <View style={styles.subRow}>
                  <Text style={styles.subApp}>
                    {item.app_name}
                    {item.plan_name ? ` — ${item.plan_name}` : ""}
                  </Text>
                  <Text style={styles.subPrice}>
                    {item.current_price} {item.currency}
                  </Text>
                </View>
              )}
            />

            {Object.keys(totalsByCurrency).length > 0 && (
              <View style={styles.totalsContainer}>
                {Object.entries(totalsByCurrency).map(([currency, total]) => (
                  <Text key={currency} style={styles.totalText}>
                    Toplam ({currency}): {total.toFixed(2)}
                  </Text>
                ))}
              </View>
            )}
          </>
        )}
      </View>

      <TouchableOpacity
        style={styles.manageButton}
        onPress={() => navigation.navigate("Catalog")}
      >
        <Text style={styles.buttonText}>Aboneliklerimi Yönet</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={logout}>
        <Text style={styles.buttonText}>Çıkış Yap</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 24,
    textAlign: "center",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  loading: {
    marginVertical: 12,
  },
  error: {
    color: "#dc2626",
  },
  empty: {
    color: "#666",
  },
  subRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  subApp: {
    fontSize: 15,
    flex: 1,
    marginRight: 12,
  },
  subPrice: {
    fontSize: 15,
    fontWeight: "600",
  },
  totalsContainer: {
    marginTop: 12,
  },
  totalText: {
    fontSize: 15,
    fontWeight: "600",
  },
  manageButton: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#dc2626",
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import * as api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../theme";

export default function HomeScreen({ navigation }) {
  const { user, token, logout } = useAuth();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
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
  const totalEntries = Object.entries(totalsByCurrency);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.greeting}>Hoş geldin, {user?.email}</Text>

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Toplam Aylık Gider</Text>
        {totalEntries.length > 0 ? (
          totalEntries.map(([currency, total]) => (
            <Text key={currency} style={styles.totalValue}>
              {total.toFixed(2)} {currency}
            </Text>
          ))
        ) : (
          <Text style={styles.totalValue}>0.00</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Seçtiğim Abonelikler</Text>

        {loading ? (
          <ActivityIndicator style={styles.loading} color={theme.colors.accent} />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : subscriptions.length === 0 ? (
          <Text style={styles.empty}>Henüz bir abonelik seçmedin</Text>
        ) : (
          subscriptions.map((item) => (
            <View key={item.id} style={styles.subCard}>
              <View style={styles.subInfo}>
                <Text style={styles.subApp}>{item.app_name}</Text>
                {item.plan_name ? <Text style={styles.subPlan}>{item.plan_name}</Text> : null}
              </View>
              <Text style={styles.subPrice}>
                {item.current_price} {item.currency}
              </Text>
            </View>
          ))
        )}
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => navigation.navigate("Catalog")}
      >
        <Text style={styles.primaryButtonText}>Aboneliklerimi Yönet</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={logout}>
        <Text style={styles.secondaryButtonText}>Çıkış Yap</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function createStyles(theme) {
  const { colors, spacing, radius } = theme;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: spacing.lg,
      paddingBottom: spacing.xl,
    },
    greeting: {
      fontSize: 15,
      color: colors.textSecondary,
      marginBottom: spacing.lg,
    },
    totalCard: {
      backgroundColor: colors.surface,
      borderRadius: radius,
      padding: spacing.lg,
      marginBottom: spacing.xl,
    },
    totalLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: "500",
      marginBottom: spacing.xs,
    },
    totalValue: {
      fontSize: 34,
      fontWeight: "700",
      color: colors.text,
    },
    section: {
      marginBottom: spacing.xl,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.text,
      marginBottom: spacing.md,
    },
    loading: {
      marginVertical: spacing.md,
    },
    error: {
      color: colors.error,
      fontSize: 14,
    },
    empty: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    subCard: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: radius,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    subInfo: {
      flex: 1,
      marginRight: spacing.md,
    },
    subApp: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
    },
    subPlan: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    subPrice: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
    },
    primaryButton: {
      backgroundColor: colors.accent,
      borderRadius: radius,
      paddingVertical: spacing.md - 2,
      alignItems: "center",
      marginBottom: spacing.sm,
    },
    primaryButtonText: {
      color: colors.accentText,
      fontSize: 16,
      fontWeight: "600",
    },
    secondaryButton: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius,
      paddingVertical: spacing.md - 2,
      alignItems: "center",
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "600",
    },
  });
}

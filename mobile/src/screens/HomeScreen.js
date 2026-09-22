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

function getNextBillingInfo(billingDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function clampedDate(year, month) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(billingDate, daysInMonth));
  }

  let next = clampedDate(today.getFullYear(), today.getMonth());
  if (next < today) {
    const month = today.getMonth() + 1;
    next = clampedDate(today.getFullYear() + (month > 11 ? 1 : 0), month % 12);
  }

  const daysLeft = Math.round((next - today) / (1000 * 60 * 60 * 24));
  return { daysLeft };
}

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

  const upcomingPayments = subscriptions
    .filter((sub) => sub.billing_date)
    .map((sub) => ({ ...sub, ...getNextBillingInfo(sub.billing_date) }))
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 3);

  const categoryTotals = subscriptions.reduce((totals, sub) => {
    const key = sub.category || "Diğer";
    totals[key] = (totals[key] || 0) + Number(sub.current_price);
    return totals;
  }, {});
  const categoryEntries = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  const categoryGrandTotal = categoryEntries.reduce((sum, [, value]) => sum + value, 0);

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

      {upcomingPayments.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Yaklaşan Ödemeler</Text>

          {upcomingPayments.map((item) => (
            <View key={item.id} style={styles.upcomingRow}>
              <Text style={styles.upcomingApp}>{item.app_name}</Text>
              <View style={styles.upcomingBadge}>
                <Text style={styles.upcomingBadgeText}>
                  {item.daysLeft <= 0 ? "Bugün" : `${item.daysLeft} gün kaldı`}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {categoryEntries.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kategoriye Göre Dağılım</Text>

          {categoryEntries.map(([category, total]) => {
            const percent = categoryGrandTotal > 0 ? (total / categoryGrandTotal) * 100 : 0;

            return (
              <View key={category} style={styles.categoryRow}>
                <View style={styles.categoryHeader}>
                  <Text style={styles.categoryName}>{category}</Text>
                  <Text style={styles.categoryValue}>
                    {total.toFixed(2)} ₺ · %{percent.toFixed(0)}
                  </Text>
                </View>
                <View style={styles.categoryBarTrack}>
                  <View style={[styles.categoryBarFill, { width: `${percent}%` }]} />
                </View>
              </View>
            );
          })}
        </View>
      )}

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
            <TouchableOpacity
              key={item.id}
              style={styles.subCard}
              onPress={() => navigation.navigate("SubscriptionDetail", { subscription: item })}
            >
              <View style={styles.subInfo}>
                <Text style={styles.subApp}>{item.app_name}</Text>
                {item.plan_name ? <Text style={styles.subPlan}>{item.plan_name}</Text> : null}
                {item.reason ? <Text style={styles.subReason}>{item.reason}</Text> : null}
              </View>
              <Text style={styles.subPrice}>
                {item.current_price} {item.currency}
              </Text>
            </TouchableOpacity>
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
    upcomingRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: radius,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    upcomingApp: {
      fontSize: 15,
      fontWeight: "500",
      color: colors.text,
    },
    upcomingBadge: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm + 2,
    },
    upcomingBadgeText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.accent,
    },
    categoryRow: {
      marginBottom: spacing.md,
    },
    categoryHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: spacing.xs,
    },
    categoryName: {
      fontSize: 14,
      fontWeight: "500",
      color: colors.text,
    },
    categoryValue: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    categoryBarTrack: {
      height: 8,
      borderRadius: radius,
      backgroundColor: colors.surface,
      overflow: "hidden",
    },
    categoryBarFill: {
      height: "100%",
      borderRadius: radius,
      backgroundColor: colors.accent,
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
    subReason: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
      fontStyle: "italic",
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

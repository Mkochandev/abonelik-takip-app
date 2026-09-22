import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import * as api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../theme";
import { formatSubscriptionPrice } from "../utils/price";

export default function SubscriptionDetailScreen({ navigation, route }) {
  const { subscription } = route.params;
  const { token } = useAuth();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [catalogItem, setCatalogItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [priceAlertEnabled, setPriceAlertEnabled] = useState(subscription.price_alert_enabled);
  const [savingAlert, setSavingAlert] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function fetchCatalogItem() {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getCatalogItem(subscription.catalog_id);
        if (isActive) {
          setCatalogItem(data);
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

    fetchCatalogItem();

    return () => {
      isActive = false;
    };
  }, [subscription.catalog_id]);

  async function handleToggleAlert(value) {
    setPriceAlertEnabled(value);
    setSavingAlert(true);
    try {
      await api.updateUserSubscription(token, subscription.id, { price_alert_enabled: value });
    } catch (err) {
      setPriceAlertEnabled(!value);
      Alert.alert("Hata", err.message);
    } finally {
      setSavingAlert(false);
    }
  }

  function handleCancel() {
    if (catalogItem?.cancel_url) {
      Linking.openURL(catalogItem.cancel_url);
    }
  }

  const priceHistory = catalogItem?.price_history || [];
  const maxPrice = priceHistory.reduce((max, entry) => Math.max(max, Number(entry.price)), 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
        <Text style={styles.backLinkText}>‹ Geri</Text>
      </TouchableOpacity>

      <View style={styles.infoCard}>
        <Text style={styles.appName}>{subscription.app_name}</Text>
        {subscription.plan_name ? <Text style={styles.planName}>{subscription.plan_name}</Text> : null}

        <Text style={styles.price}>{formatSubscriptionPrice(subscription)}</Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Kullanım sıklığı</Text>
          <Text style={styles.metaValue}>{subscription.usage_frequency || "—"}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Fatura günü</Text>
          <Text style={styles.metaValue}>
            {subscription.billing_date ? `Her ayın ${subscription.billing_date}. günü` : "—"}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.switchRow}>
          <Text style={styles.sectionTitle}>Zam olursa haber ver</Text>
          <Switch
            value={priceAlertEnabled}
            onValueChange={handleToggleAlert}
            disabled={savingAlert}
            trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
            thumbColor={theme.colors.background}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Fiyat Geçmişi</Text>

        {loading ? (
          <ActivityIndicator color={theme.colors.accent} />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : priceHistory.length === 0 ? (
          <Text style={styles.empty}>Fiyat geçmişi kaydı yok</Text>
        ) : (
          priceHistory.map((entry) => (
            <View key={entry.id} style={styles.historyRow}>
              <View style={styles.historyLabelRow}>
                <Text style={styles.historyDate}>
                  {new Date(entry.changed_at).toLocaleDateString("tr-TR")}
                </Text>
                <Text style={styles.historyPrice}>{entry.price}</Text>
              </View>
              <View style={styles.historyBarTrack}>
                <View
                  style={[
                    styles.historyBarFill,
                    { width: `${maxPrice > 0 ? (Number(entry.price) / maxPrice) * 100 : 0}%` },
                  ]}
                />
              </View>
            </View>
          ))
        )}
      </View>

      {catalogItem?.cancel_url ? (
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
          <Text style={styles.cancelButtonText}>Aboneliği İptal Et</Text>
        </TouchableOpacity>
      ) : null}
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
    backLink: {
      marginBottom: spacing.md,
    },
    backLinkText: {
      fontSize: 15,
      color: colors.accent,
      fontWeight: "500",
    },
    infoCard: {
      backgroundColor: colors.surface,
      borderRadius: radius,
      padding: spacing.lg,
      marginBottom: spacing.xl,
    },
    appName: {
      fontSize: 22,
      fontWeight: "700",
      color: colors.text,
    },
    planName: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 2,
    },
    price: {
      fontSize: 30,
      fontWeight: "700",
      color: colors.text,
      marginTop: spacing.md,
      marginBottom: spacing.md,
    },
    metaRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    metaLabel: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    metaValue: {
      fontSize: 14,
      fontWeight: "500",
      color: colors.text,
    },
    section: {
      marginBottom: spacing.xl,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
    },
    switchRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    error: {
      color: colors.error,
      fontSize: 14,
      marginTop: spacing.sm,
    },
    empty: {
      color: colors.textSecondary,
      fontSize: 14,
      marginTop: spacing.sm,
    },
    historyRow: {
      marginTop: spacing.md,
    },
    historyLabelRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: spacing.xs,
    },
    historyDate: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    historyPrice: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.text,
    },
    historyBarTrack: {
      height: 8,
      borderRadius: radius,
      backgroundColor: colors.surface,
      overflow: "hidden",
    },
    historyBarFill: {
      height: "100%",
      borderRadius: radius,
      backgroundColor: colors.accent,
    },
    cancelButton: {
      borderWidth: 1,
      borderColor: colors.error,
      borderRadius: radius,
      paddingVertical: spacing.md - 2,
      alignItems: "center",
    },
    cancelButtonText: {
      color: colors.error,
      fontSize: 16,
      fontWeight: "600",
    },
  });
}

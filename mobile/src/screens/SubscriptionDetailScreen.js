import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as api from "../api/client";
import { Card, CategoryTag, GroupedList, GroupedListRow, PillButton, ServiceLogo, Toggle } from "../components";
import { useAuth } from "../context/AuthContext";
import { removeGuestSubscription } from "../storage/guestSubscriptions";
import { fontFamily, useTheme } from "../theme";
import { formatAmount, formatSubscriptionPrice } from "../utils/price";
import { withAccusativeSuffix } from "../utils/turkish";

function ChartUpIcon({ color }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 18l5-6 4 3 7-9M15 6h5v5"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function SubscriptionDetailScreen({ navigation, route }) {
  const { subscription } = route.params;
  // Misafir kaydı yalnızca katalog bilgisini taşır; hesaba bağlı alanlar
  // (neden, sıklık, ödeme günü, zam bildirimi) gösterilmez.
  const isGuest = Boolean(subscription.isGuest);
  const { token } = useAuth();
  const { colors, spacing, brand } = useTheme();
  const insets = useSafeAreaInsets();

  const [catalogItem, setCatalogItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [priceAlertEnabled, setPriceAlertEnabled] = useState(subscription.price_alert_enabled);
  const [savingAlert, setSavingAlert] = useState(false);
  const [removing, setRemoving] = useState(false);

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

  async function removeSubscription() {
    setRemoving(true);
    try {
      if (isGuest) {
        await removeGuestSubscription(subscription.catalog_id);
      } else {
        await api.removeUserSubscription(token, subscription.id);
      }
      // Ana sayfa odaklandığında listeyi yeniden yükler.
      navigation.navigate("MainTabs", { screen: "Home" });
    } catch (err) {
      setRemoving(false);
      Alert.alert("Hata", err.message);
    }
  }

  function handleRemovePress() {
    Alert.alert(
      "Aboneliği kaldır",
      `${subscription.app_name} takip listenden kaldırılsın mı? Bu işlem servisteki aboneliğini iptal etmez.`,
      [
        { text: "Vazgeç", style: "cancel" },
        { text: "Kaldır", style: "destructive", onPress: removeSubscription },
      ]
    );
  }

  const price = formatSubscriptionPrice(subscription);
  const priceHistory = catalogItem?.price_history || [];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        padding: spacing.md,
        paddingTop: insets.top + spacing.sm,
        paddingBottom: spacing.xl,
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

      <Card style={{ marginBottom: spacing.lg }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <ServiceLogo
            domain={subscription.domain}
            logoUrl={subscription.logo_url}
            name={subscription.app_name}
            category={subscription.category}
            size={56}
          />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fontFamily.extraBold, fontSize: 28, color: colors.text }}>
              {subscription.app_name}
            </Text>
            {subscription.plan_name ? (
              <Text style={{ color: colors.text2, marginTop: 2 }}>{subscription.plan_name}</Text>
            ) : null}
          </View>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginTop: spacing.md,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
            <Text style={{ fontFamily: fontFamily.extraBold, fontSize: 40, color: colors.text }}>
              {price.primary}
            </Text>
            <Text style={{ color: colors.text2, fontSize: 15 }}>/ ay</Text>
          </View>
          {subscription.category ? <CategoryTag category={subscription.category} /> : null}
        </View>
        {price.secondary ? (
          <Text style={{ color: colors.text2, marginTop: 2 }}>{price.secondary}</Text>
        ) : null}
      </Card>

      {isGuest ? (
        <GroupedList style={{ marginBottom: spacing.lg }}>
          <GroupedListRow
            onPress={() =>
              navigation.navigate("Register", {
                promptMessage: "Hatırlatma ve zam bildirimi için hesap oluştur",
              })
            }
            style={{ justifyContent: "space-between" }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "600" }}>
                Bu özellikler için hesap oluştur
              </Text>
              <Text style={{ color: colors.text2, fontSize: 13, marginTop: 2 }}>
                Neden, kullanım sıklığı, ödeme günü ve zam bildirimi
              </Text>
            </View>
            <Text style={{ color: colors.text2, fontSize: 18 }}>›</Text>
          </GroupedListRow>
        </GroupedList>
      ) : (
        <GroupedList style={{ marginBottom: spacing.lg }}>
          <GroupedListRow style={{ justifyContent: "space-between" }}>
            <Text style={{ color: colors.text2 }}>Kullanım sıklığı</Text>
            <Text style={{ color: colors.text, fontWeight: "600" }}>
              {subscription.usage_frequency || "—"}
            </Text>
          </GroupedListRow>
          <GroupedListRow style={{ justifyContent: "space-between" }}>
            <Text style={{ color: colors.text2 }}>Ödeme günü</Text>
            <Text style={{ color: colors.text, fontWeight: "600" }}>
              {subscription.billing_date
                ? `Her ayın ${withAccusativeSuffix(subscription.billing_date)}`
                : "—"}
            </Text>
          </GroupedListRow>
          <GroupedListRow style={{ justifyContent: "space-between" }}>
            <Text style={{ color: colors.text2 }}>Neden</Text>
            <Text style={{ color: colors.text, fontWeight: "600", flexShrink: 1, textAlign: "right" }}>
              {subscription.reason || "—"}
            </Text>
          </GroupedListRow>
        </GroupedList>
      )}

      <Card style={{ marginBottom: spacing.lg }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "#FFE3A3",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ChartUpIcon color={brand.ink} />
          </View>
          <Text style={{ fontFamily: fontFamily.bold, fontSize: 16, color: colors.text }}>
            Fiyat geçmişi
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : error ? (
          <Text style={{ color: colors.danger }}>{error}</Text>
        ) : priceHistory.length === 0 ? (
          <Text style={{ color: colors.text2 }}>
            Henüz değişiklik yok. Yeni bir fiyat bulunduğunda eski fiyatlar burada tarihleriyle
            listelenir.
          </Text>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {priceHistory.map((entry) => (
              <View
                key={entry.id}
                style={{ flexDirection: "row", justifyContent: "space-between" }}
              >
                <Text style={{ color: colors.text2 }}>
                  {new Date(entry.changed_at).toLocaleDateString("tr-TR")}
                </Text>
                <Text style={{ color: colors.text, fontWeight: "600" }}>
                  {formatAmount(entry.price, catalogItem?.currency ?? subscription.currency)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      {!isGuest ? (
        <Card style={{ marginBottom: spacing.lg }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontFamily: fontFamily.bold, fontSize: 16, color: colors.text }}>
              Zam olursa haber ver
            </Text>
            <Toggle value={priceAlertEnabled} onValueChange={handleToggleAlert} disabled={savingAlert} />
          </View>
        </Card>
      ) : null}

      {catalogItem?.cancel_url ? (
        <View>
          <PillButton title="Aboneliği iptal et" variant="danger" onPress={handleCancel} />
          <Text style={{ color: colors.text2, fontSize: 12, textAlign: "center", marginTop: spacing.sm }}>
            İptal sayfası tarayıcıda açılır
          </Text>
        </View>
      ) : null}

      <Pressable
        onPress={handleRemovePress}
        disabled={removing}
        accessibilityRole="button"
        style={({ pressed }) => ({
          alignItems: "center",
          justifyContent: "center",
          minHeight: 48,
          marginTop: spacing.md,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        {removing ? (
          <ActivityIndicator color={brand.mercan} />
        ) : (
          <Text style={{ color: brand.mercan, fontWeight: "700", fontSize: 15.5 }}>
            Aboneliği kaldır
          </Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

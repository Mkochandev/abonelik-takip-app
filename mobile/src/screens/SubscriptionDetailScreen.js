import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as api from "../api/client";
import {
  BillingDaySheet,
  Card,
  CategoryTag,
  GroupedList,
  GroupedListRow,
  KivirikHead,
  PillButton,
  ServiceLogo,
} from "../components";
import { useAuth } from "../context/AuthContext";
import { maybeAskForReminders, rescheduleAll } from "../services/reminders";
import { removeGuestSubscription, updateGuestSubscription } from "../storage/guestSubscriptions";
import { fontFamily, useTheme } from "../theme";
import { formatBillingDay, periodLabel } from "../utils/billing";
import { formatAmount, formatSubscriptionPrice } from "../utils/price";

export default function SubscriptionDetailScreen({ navigation, route }) {
  const { subscription: initialSubscription } = route.params;
  // Misafir kaydı katalog bilgisini ve ödeme gününü taşır; neden ve
  // kullanım sıklığı hesap gerektirir.
  const isGuest = Boolean(initialSubscription.isGuest);
  const { token } = useAuth();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  // Ödeme günü bu ekranda düzenlenebildiği için kayıt yerel state'te.
  const [subscription, setSubscription] = useState(initialSubscription);
  const [billingSheetOpen, setBillingSheetOpen] = useState(false);
  const [catalogItem, setCatalogItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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

  // Ana sayfa odaklandığında listeyi yeniden yüklediği için yalnızca yerel
  // kayıt güncellenir.
  async function saveBillingDay(item, updates) {
    if (isGuest) {
      await updateGuestSubscription(item.catalog_id, updates);
    } else {
      await api.updateUserSubscription(token, item.id, updates);
    }
    setSubscription((current) => ({ ...current, ...updates }));
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
            <Text style={{ color: colors.text2, fontSize: 15 }}>{periodLabel(subscription)}</Text>
          </View>
          {subscription.category ? <CategoryTag category={subscription.category} /> : null}
        </View>
        {price.secondary ? (
          <Text style={{ color: colors.text2, marginTop: 2 }}>{price.secondary}</Text>
        ) : null}
      </Card>

      <GroupedList style={{ marginBottom: spacing.sm }}>
        <GroupedListRow
          onPress={() => setBillingSheetOpen(true)}
          style={{ justifyContent: "space-between" }}
        >
          <Text style={{ color: colors.text2 }}>Ödeme günü</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            <Text style={{ color: colors.text, fontWeight: "600" }}>
              {formatBillingDay(subscription) ?? "Ekle"}
            </Text>
            <Text style={{ color: colors.text2, fontSize: 18 }}>›</Text>
          </View>
        </GroupedListRow>
      </GroupedList>

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
                Neden ve kullanım sıklığı
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
            <Text style={{ color: colors.text2 }}>Neden</Text>
            <Text style={{ color: colors.text, fontWeight: "600", flexShrink: 1, textAlign: "right" }}>
              {subscription.reason || "—"}
            </Text>
          </GroupedListRow>
        </GroupedList>
      )}

      <Card style={{ marginBottom: spacing.lg }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md }}>
          <KivirikHead size={44} mood="dusunceli" />
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
            Kıvırık bu fiyatı takip ediyor. Henüz değişiklik yok; zam gelirse eski fiyatlar burada
            tarihleriyle görünür.
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

      {catalogItem?.cancel_url ? (
        <View>
          <PillButton title="Aboneliği iptal et" variant="danger" onPress={handleCancel} />
          <Text style={{ color: colors.text2, fontSize: 12, textAlign: "center", marginTop: spacing.sm }}>
            {subscription.app_name} — iptal sayfası tarayıcıda açılır
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
          marginTop: spacing.sm,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        {removing ? (
          <ActivityIndicator color={colors.text2} />
        ) : (
          <Text
            style={{
              color: colors.text2,
              fontWeight: "600",
              fontSize: 14.5,
              textDecorationLine: "underline",
            }}
          >
            Takip listesinden kaldır
          </Text>
        )}
      </Pressable>

      <BillingDaySheet
        items={billingSheetOpen ? [subscription] : null}
        onSave={saveBillingDay}
        onClose={() => {
          setBillingSheetOpen(false);
          rescheduleAll();
          if (subscription.billing_date) {
            maybeAskForReminders();
          }
        }}
      />
    </ScrollView>
  );
}

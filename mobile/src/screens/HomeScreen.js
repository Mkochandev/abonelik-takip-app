import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as api from "../api/client";
import {
  AppTile,
  BrandIcon,
  Card,
  CategoryBadge,
  GroupedList,
  GroupedListRow,
  PillButton,
} from "../components";
import { useAuth } from "../context/AuthContext";
import { fontFamily, useTheme } from "../theme";
import { formatSubscriptionPrice, formatTRY } from "../utils/price";

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
  const dateLabel = next.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
  });

  return { daysLeft, dateLabel };
}

export default function HomeScreen({ navigation }) {
  const { user, token } = useAuth();
  const { colors, spacing, typography, brand, categories } = useTheme();
  const insets = useSafeAreaInsets();
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);
  const subsSectionY = useRef(0);

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

  const totalTry = subscriptions.reduce(
    (sum, sub) => sum + Number(sub.current_price_try ?? sub.current_price),
    0
  );
  const hasUsd = subscriptions.some((sub) => sub.currency === "USD");

  const upcomingPayments = subscriptions
    .filter((sub) => sub.billing_date)
    .map((sub) => ({ ...sub, ...getNextBillingInfo(sub.billing_date) }))
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 3);

  const categoryTotals = subscriptions.reduce((totals, sub) => {
    const key = sub.category || "Diğer";
    totals[key] = (totals[key] || 0) + Number(sub.current_price_try ?? sub.current_price);
    return totals;
  }, {});
  const categoryEntries = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  const categoryGrandTotal = categoryEntries.reduce((sum, [, value]) => sum + value, 0);

  function goToCatalog() {
    navigation.navigate("Catalog");
  }

  function scrollToSubscriptions() {
    scrollRef.current?.scrollTo({ y: subsSectionY.current, animated: true });
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        padding: spacing.md,
        paddingTop: insets.top + spacing.sm,
        paddingBottom: spacing.xl,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: spacing.lg,
        }}
      >
        <View>
          <Text style={[typography.screenTitle, { color: colors.text }]}>Merhaba</Text>
          <Text style={{ color: colors.text2, fontSize: 14, marginTop: 2 }}>
            {user?.email}
          </Text>
        </View>
        <BrandIcon size={40} />
      </View>

      <Card noPadding style={{ marginBottom: spacing.lg }}>
        <View style={{ padding: spacing.md }}>
          <Text style={{ color: colors.text2, fontSize: 13, fontWeight: "600" }}>
            Aylık toplam
          </Text>
          <Text style={[typography.amountLarge, { color: colors.text, marginTop: 4 }]}>
            {formatTRY(totalTry)}
          </Text>
          <Text style={{ color: colors.text2, fontSize: 13, marginTop: 6 }}>
            {subscriptions.length} abonelik.
            {hasUsd ? " Dolar planları güncel kurla hesaplandı." : ""}
          </Text>
        </View>

        <View style={{ height: 1, backgroundColor: colors.divider }} />

        <View style={{ flexDirection: "row", height: 56 }}>
          <Pressable
            onPress={goToCatalog}
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ fontWeight: "700", color: colors.text }}>Abonelik ekle</Text>
          </Pressable>
          <View style={{ width: 1, backgroundColor: colors.divider }} />
          <Pressable
            onPress={scrollToSubscriptions}
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ fontWeight: "700", color: colors.text }}>Aboneliklerim</Text>
          </Pressable>
        </View>
      </Card>

      {upcomingPayments.length > 0 && (
        <View style={{ marginBottom: spacing.lg }}>
          <Text style={[typography.sectionTitle, { color: colors.text, marginBottom: spacing.sm }]}>
            Yaklaşan ödemeler
          </Text>

          <GroupedList>
            {upcomingPayments.map((item) => {
              const price = formatSubscriptionPrice(item);
              return (
                <GroupedListRow
                  key={item.id}
                  onPress={() =>
                    navigation.navigate("SubscriptionDetail", { subscription: item })
                  }
                >
                  <AppTile name={item.app_name} color={categories[item.category]} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: "600" }} numberOfLines={1}>
                      {item.app_name}
                      {item.plan_name ? ` ${item.plan_name}` : ""}
                    </Text>
                    <Text style={{ color: colors.text2, fontSize: 13, marginTop: 2 }}>
                      {item.dateLabel}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontWeight: "700", color: colors.text }}>{price.primary}</Text>
                    <View
                      style={{
                        backgroundColor: brand.safran,
                        borderRadius: 999,
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        marginTop: 4,
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: "700", color: brand.ink }}>
                        {item.daysLeft <= 0 ? "Bugün" : `${item.daysLeft} gün`}
                      </Text>
                    </View>
                  </View>
                </GroupedListRow>
              );
            })}
          </GroupedList>
        </View>
      )}

      {categoryEntries.length > 0 && (
        <View style={{ marginBottom: spacing.lg }}>
          <Text style={[typography.sectionTitle, { color: colors.text, marginBottom: spacing.sm }]}>
            Kategoriler
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {categoryEntries.map(([category, total]) => {
              const percent = categoryGrandTotal > 0 ? (total / categoryGrandTotal) * 100 : 0;

              return (
                <Card key={category} style={{ width: "47%" }}>
                  <CategoryBadge category={category} />
                  <Text style={{ color: colors.text2, fontSize: 13, marginTop: spacing.sm }}>
                    {category}
                  </Text>
                  <Text
                    style={{
                      fontFamily: fontFamily.bold,
                      fontSize: 22,
                      color: colors.text,
                      marginTop: 2,
                    }}
                  >
                    {formatTRY(total)}
                  </Text>
                  <Text style={{ color: colors.text2, fontSize: 12, marginTop: 2 }}>
                    Toplamın %{percent.toFixed(0)}
                  </Text>
                </Card>
              );
            })}
          </View>
        </View>
      )}

      <View onLayout={(event) => (subsSectionY.current = event.nativeEvent.layout.y)}>
        <Text style={[typography.sectionTitle, { color: colors.text, marginBottom: spacing.sm }]}>
          Aboneliklerim
        </Text>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />
        ) : error ? (
          <Text style={{ color: colors.danger }}>{error}</Text>
        ) : subscriptions.length === 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={{ color: colors.text2 }}>Henüz bir abonelik eklemedin.</Text>
            <PillButton title="Abonelik ekle" onPress={goToCatalog} />
          </View>
        ) : (
          <GroupedList>
            {subscriptions.map((item) => {
              const price = formatSubscriptionPrice(item);
              return (
                <GroupedListRow
                  key={item.id}
                  onPress={() =>
                    navigation.navigate("SubscriptionDetail", { subscription: item })
                  }
                >
                  <AppTile name={item.app_name} color={categories[item.category]} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: "600" }} numberOfLines={1}>
                      {item.app_name}
                    </Text>
                    {item.plan_name ? (
                      <Text style={{ color: colors.text2, fontSize: 13, marginTop: 1 }}>
                        {item.plan_name}
                      </Text>
                    ) : null}
                    {item.reason ? (
                      <Text
                        style={{
                          color: colors.text2,
                          fontSize: 13,
                          fontStyle: "italic",
                          marginTop: 1,
                        }}
                        numberOfLines={1}
                      >
                        {item.reason}
                      </Text>
                    ) : null}
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontWeight: "700", color: colors.text }}>{price.primary}</Text>
                    {price.secondary ? (
                      <Text style={{ fontSize: 12, color: colors.text2 }}>{price.secondary}</Text>
                    ) : null}
                  </View>
                  <Text style={{ marginLeft: spacing.xs, color: colors.text2, fontSize: 18 }}>
                    ›
                  </Text>
                </GroupedListRow>
              );
            })}
          </GroupedList>
        )}
      </View>
    </ScrollView>
  );
}

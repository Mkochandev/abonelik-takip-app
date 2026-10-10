import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as api from "../api/client";
import {
  BillingDaySheet,
  Card,
  CategoryBadge,
  Chip,
  GroupedList,
  GroupedListRow,
  KivirikBubble,
  KivirikHead,
  KivirikQuestionSheet,
  PillButton,
  ServiceLogo,
} from "../components";
import { KIVIRIK_QUESTIONS } from "../config/kivirikQuestions";
import { useAuth } from "../context/AuthContext";
import { subscribeEristeChanges } from "../services/eristeSync";
import { refreshKivirikCount, useKivirikCount, useKivirikTrigger } from "../services/kivirik";
import { maybeAskForReminders, rescheduleAll } from "../services/reminders";
import { loadSubscriptions } from "../services/subscriptionsSource";
import { getUserSettings } from "../services/userSettings";
import { GUEST_LIMIT, updateGuestSubscription } from "../storage/guestSubscriptions";
import { dismissGuestBanner, shouldShowGuestBanner } from "../storage/onboarding";
import { fontFamily, useTheme } from "../theme";
import { getNextBillingInfo, hasBillingDay, isYearly } from "../utils/billing";
import { monthlyPriceTry } from "../utils/catalog";
import { formatSubscriptionPrice, formatTRY } from "../utils/price";
import { isCountedInTotals } from "../utils/totals";

const SECTION_GAP = 26;

// [a, b, c] -> [[a, b], [c]]
function chunkPairs(items) {
  const pairs = [];
  for (let i = 0; i < items.length; i += 2) {
    pairs.push(items.slice(i, i + 2));
  }
  return pairs;
}

// Ödeme günü olan abonelikler, bir sonraki ödemeye göre sıralı (aylık/yıllık
// ve ay sonu durumu utils/billing'de).
function getUpcomingPayments(subscriptions) {
  return subscriptions
    .filter((sub) => hasBillingDay(sub) && isCountedInTotals(sub))
    .map((sub) => ({ ...sub, ...getNextBillingInfo(sub) }))
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

// Kıvırık'ın ana sayfadaki mesajı; liste yüklenmediyse null.
function getKivirikMessage(subscriptions) {
  if (subscriptions.length === 0) {
    return "Kâsen boş. Katalogdan ilk aboneliğini ekle.";
  }

  const payments = getUpcomingPayments(subscriptions);
  const first = payments[0];

  if (!first || first.daysLeft > 7) {
    return "Bu hafta ödeme yok, kâsen sakin.";
  }

  // İlk ödeme ay sonunu aşıp gelecek aya düştüyse o ayın ödemeleri sayılır.
  const count = payments.filter((item) => item.month === first.month).length;
  const when =
    first.daysLeft <= 0 ? "bugün" : first.daysLeft === 1 ? "yarın" : `${first.daysLeft} gün sonra`;

  return `Bu ay ${count} ödemen var. İlki ${when}: ${first.app_name}.`;
}

export default function HomeScreen({ navigation }) {
  const { user, token, isAuthenticated, plan, limit, pendingPaywall, consumePendingPaywall } =
    useAuth();
  const { colors, spacing, typography, brand } = useTheme();
  const insets = useSafeAreaInsets();
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showGuestBanner, setShowGuestBanner] = useState(false);
  const [bubbleOpen, setBubbleOpen] = useState(true);
  // Eksik ödeme günü akışında sorulacak abonelikler (null: kapalı).
  const [billingFlowItems, setBillingFlowItems] = useState(null);
  // erişte Premium kaydı arka planda eklendiğinde listeyi yeniden yükletir.
  const [reloadKey, setReloadKey] = useState(0);
  // Kıvırık soru paneli ve rozetteki bekleyen soru sayısı (yalnızca hesapta).
  const [questionsOpen, setQuestionsOpen] = useState(false);
  const pendingCount = useKivirikCount();
  const trigger = useKivirikTrigger();
  // "Geri al" isteği süren iptal edilmiş kayıt.
  const [restoringId, setRestoringId] = useState(null);
  const [settings, setSettings] = useState(null);
  const scrollRef = useRef(null);
  const subsSectionY = useRef(0);

  // Açılışta misafir listesi aktarılırken limite takılındıysa Paywall'ı aç.
  useEffect(() => {
    if (pendingPaywall) {
      consumePendingPaywall();
      navigation.navigate("Paywall");
    }
  }, [pendingPaywall]);

  useEffect(() => subscribeEristeChanges(() => setReloadKey((key) => key + 1)), []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      if (!token) {
        shouldShowGuestBanner().then((show) => isActive && setShowGuestBanner(show));
        setSettings(null);
      } else {
        // Rozet en fazla dakikada bir yenilenir; bütçe uyarısı için ayarlar.
        refreshKivirikCount(token);
        getUserSettings(token)
          .then((next) => isActive && setSettings(next))
          .catch(() => {});
      }

      async function fetchSubscriptions() {
        setLoading(true);
        setError(null);
        try {
          const next = await loadSubscriptions(token);
          if (isActive) {
            setSubscriptions(next);
          }
          // Ekleme/silme/gün/fiyat değişiklikleri hatırlatmalara yansısın;
          // gün girilmiş ama Kıvırık henüz sormadıysa (ör. onboarding) sorar.
          rescheduleAll(next);
          if (next.some(hasBillingDay)) {
            maybeAskForReminders();
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
    }, [token, reloadKey])
  );

  // Yıllık planlar aylık toplama 12'de biri olarak girer. Başkasının ödediği,
  // iptal edilmiş ve Premium'u bitmiş erişte kaydı toplamlara girmez.
  // İptal edilenler listenin sonunda ayrı bölümde durur.
  const paidSubscriptions = subscriptions.filter(isCountedInTotals);
  const activeSubscriptions = subscriptions.filter((sub) => !sub.cancelled_at);
  const cancelledSubscriptions = subscriptions.filter((sub) => sub.cancelled_at);
  const othersPay = activeSubscriptions.filter((sub) => sub.payment_channel === "someone_else");
  const listedSubscriptions = activeSubscriptions.filter((sub) => sub.payment_channel !== "someone_else");
  const totalTry = paidSubscriptions.reduce((sum, sub) => sum + monthlyPriceTry(sub), 0);
  const hasUsd = paidSubscriptions.some((sub) => sub.currency === "USD");
  // erişte Premium kaydı ve iptal edilenler ücretsiz plan limitine sayılmaz.
  const limitedCount = activeSubscriptions.filter((sub) => !sub.managed_by).length;

  const upcomingPayments = getUpcomingPayments(subscriptions).slice(0, 3);
  // Eksik ödeme günü balonu yalnızca misafirde; hesapta bunu Kıvırık sorar.
  const missingBilling =
    isAuthenticated || loading || error
      ? []
      : subscriptions.filter((sub) => !hasBillingDay(sub) && !sub.reminders_disabled);

  const categoryTotals = paidSubscriptions.reduce((totals, sub) => {
    const key = sub.category || "Diğer";
    totals[key] = (totals[key] || 0) + monthlyPriceTry(sub);
    return totals;
  }, {});
  const categoryEntries = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  const categoryGrandTotal = categoryEntries.reduce((sum, [, value]) => sum + value, 0);

  const monthlyBudget = settings?.monthly_budget ?? null;
  const overBudget = monthlyBudget != null && monthlyBudget > 0 && totalTry > monthlyBudget;
  const hasQuestions = isAuthenticated && pendingCount > 0;
  // Tetiklemeli soru (iptal kontrolü gibi) varsa balon doğrudan onu söyler.
  const triggerText = hasQuestions && trigger ? KIVIRIK_QUESTIONS[trigger.key]?.bubble?.(trigger.params) : null;

  // Balon önceliği: bekleyen sorular, bütçe aşımı, olağan mesaj.
  const kivirikMessage =
    loading || error
      ? null
      : hasQuestions
        ? null
        : overBudget
          ? `Bu ay aboneliklere ${formatTRY(totalTry)} gidiyor, sınırın ${formatTRY(monthlyBudget)}. Gözden geçirelim mi?`
          : getKivirikMessage(paidSubscriptions);

  // Misafirde Kıvırık soru sormaz; giriş ekranına yönlendirir.
  function handleKivirikPress() {
    if (!isAuthenticated) {
      navigation.navigate("Login", {
        promptMessage: "Giriş yaparsan sana daha çok yardımcı olabilirim.",
      });
      return;
    }
    if (pendingCount > 0) {
      setQuestionsOpen(true);
      return;
    }
    setBubbleOpen((open) => !open);
  }

  function handleQuestionsClose({ changed }) {
    setQuestionsOpen(false);
    if (changed) {
      setReloadKey((key) => key + 1);
      refreshKivirikCount(token, { force: true });
      getUserSettings(token, { force: true })
        .then(setSettings)
        .catch(() => {});
    }
  }

  async function restoreSubscription(item) {
    setRestoringId(item.id);
    try {
      await api.restoreUserSubscription(token, item.id);
      setReloadKey((key) => key + 1);
      refreshKivirikCount(token, { force: true });
    } catch (err) {
      if (err.code === "LIMIT_REACHED") {
        navigation.navigate("Paywall");
      } else {
        Alert.alert("Kaydedilemedi", err.message);
      }
    } finally {
      setRestoringId(null);
    }
  }

  function renderCancelledRow(item) {
    return (
      <GroupedListRow
        key={item.id}
        onPress={() => navigation.navigate("SubscriptionDetail", { subscription: item })}
      >
        <View style={{ opacity: 0.55 }}>
          <ServiceLogo
            domain={item.domain}
            logoUrl={item.logo_url}
            name={item.app_name}
            category={item.category}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "600" }} numberOfLines={1}>
            {item.app_name}
            {item.plan_name ? ` ${item.plan_name}` : ""}
          </Text>
          <Text style={{ color: colors.text2, fontSize: 13, marginTop: 1 }}>
            İptal edildi · {new Date(item.cancelled_at).toLocaleDateString("tr-TR")}
          </Text>
        </View>
        {restoringId === item.id ? (
          <ActivityIndicator color={colors.text2} />
        ) : (
          <Chip label="Geri al" onPress={() => restoreSubscription(item)} />
        )}
      </GroupedListRow>
    );
  }

  function goToCatalog() {
    navigation.navigate("Catalog");
  }

  function scrollToSubscriptions() {
    scrollRef.current?.scrollTo({ y: subsSectionY.current, animated: true });
  }

  // Eksik gün akışında her kayıt ayrı ayrı kaydedilir; liste yerinde
  // güncellenir ki balon ve yaklaşan ödemeler hemen değişsin.
  async function saveBillingDay(item, updates) {
    if (item.isGuest) {
      await updateGuestSubscription(item.catalog_id, updates);
    } else {
      await api.updateUserSubscription(token, item.id, updates);
    }
    setSubscriptions((current) =>
      current.map((sub) => (sub.id === item.id ? { ...sub, ...updates } : sub))
    );
  }

  function renderSubscriptionRow(item) {
    const price = formatSubscriptionPrice(item);
    return (
      <GroupedListRow
        key={item.id}
        onPress={() =>
          navigation.navigate("SubscriptionDetail", { subscription: item })
        }
      >
        <ServiceLogo
          domain={item.domain}
          logoUrl={item.logo_url}
          name={item.app_name}
          category={item.category}
        />
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
          <Text style={{ fontWeight: "700", color: colors.text }}>
            {price.primary}
            {isYearly(item) ? " / yıl" : ""}
          </Text>
          {price.secondary ? (
            <Text style={{ fontSize: 12, color: colors.text2 }}>{price.secondary}</Text>
          ) : null}
        </View>
        <Text style={{ marginLeft: spacing.xs, color: colors.text2, fontSize: 18 }}>
          ›
        </Text>
      </GroupedListRow>
    );
  }

  function handleDismissGuestBanner() {
    setShowGuestBanner(false);
    dismissGuestBanner().catch(() => {});
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
          marginBottom: hasQuestions || (kivirikMessage && bubbleOpen) ? spacing.sm : SECTION_GAP,
        }}
      >
        <View>
          <Text style={[typography.screenTitle, { color: colors.text }]}>Merhaba</Text>
          <Text style={{ color: colors.text2, fontSize: 14, marginTop: 2 }}>
            {isAuthenticated ? user?.email : "Misafir"}
          </Text>
        </View>
        <Pressable
          onPress={handleKivirikPress}
          accessibilityRole="button"
          accessibilityLabel={hasQuestions ? `Kıvırık: ${pendingCount} sorusu var` : "Kıvırık"}
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.card,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <KivirikHead size={46} />
          {hasQuestions ? (
            <View
              style={{
                position: "absolute",
                top: -2,
                right: -4,
                minWidth: 22,
                height: 22,
                paddingHorizontal: 6,
                borderRadius: 11,
                backgroundColor: brand.biber,
                borderWidth: 2,
                borderColor: colors.bg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "800" }}>
                {pendingCount > 9 ? "9+" : pendingCount}
              </Text>
            </View>
          ) : kivirikMessage ? (
            <View
              style={{
                position: "absolute",
                top: 1,
                right: 1,
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: brand.biber,
                borderWidth: 2,
                borderColor: colors.bg,
              }}
            />
          ) : null}
        </Pressable>
      </View>

      {hasQuestions ? (
        <Pressable
          onPress={() => setQuestionsOpen(true)}
          accessibilityRole="button"
          style={({ pressed }) => ({
            alignSelf: "flex-end",
            maxWidth: 300,
            marginBottom: SECTION_GAP,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <KivirikBubble tail="right">
            <Text style={{ color: "#F5F3F7", fontSize: 15, fontWeight: "600", lineHeight: 21 }}>
              {triggerText ??
                `Dur, sana soracaklarım var! ${pendingCount > 9 ? "9+" : pendingCount} kısa soru.`}
            </Text>
            <Text style={{ color: brand.safran, fontSize: 13, fontWeight: "700", marginTop: 4 }}>
              Cevapla
            </Text>
          </KivirikBubble>
        </Pressable>
      ) : kivirikMessage && bubbleOpen ? (
        <Pressable
          onPress={overBudget ? scrollToSubscriptions : undefined}
          disabled={!overBudget}
          accessibilityRole={overBudget ? "button" : undefined}
          style={{ alignSelf: "flex-end", maxWidth: 300, marginBottom: SECTION_GAP }}
        >
          <KivirikBubble tail="right">
            <Text style={{ color: "#F5F3F7", fontSize: 15, fontWeight: "600", lineHeight: 21 }}>
              {kivirikMessage}
            </Text>
            {overBudget ? (
              <Text style={{ color: brand.safran, fontSize: 13, fontWeight: "700", marginTop: 4 }}>
                Aboneliklerime bak
              </Text>
            ) : null}
          </KivirikBubble>
        </Pressable>
      ) : null}

      {missingBilling.length > 0 ? (
        <Pressable
          onPress={() => setBillingFlowItems(missingBilling)}
          accessibilityRole="button"
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "flex-end",
            gap: spacing.sm,
            marginBottom: SECTION_GAP,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <KivirikHead size={48} mood="dusunceli" />
          <KivirikBubble tail="left" style={{ flex: 1 }}>
            <Text style={{ color: "#F5F3F7", fontSize: 15, fontWeight: "600", lineHeight: 21 }}>
              {missingBilling.length} aboneliğinin ödeme günü eksik. Ekle de sana haber vereyim.
            </Text>
            <Text style={{ color: brand.safran, fontWeight: "700", marginTop: spacing.xs }}>
              Günleri ekle ›
            </Text>
          </KivirikBubble>
        </Pressable>
      ) : null}

      {!isAuthenticated && showGuestBanner ? (
        <Card style={{ marginBottom: SECTION_GAP }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}>
            <Text style={{ flex: 1, color: colors.text, fontWeight: "600", lineHeight: 21 }}>
              Abonelikler sadece bu cihazda. Kaybolmaması ve zam bildirimi için hesap oluştur.
            </Text>
            <Pressable
              onPress={handleDismissGuestBanner}
              accessibilityRole="button"
              accessibilityLabel="Kapat"
              hitSlop={12}
            >
              <Text style={{ color: colors.text2, fontSize: 20, lineHeight: 22 }}>×</Text>
            </Pressable>
          </View>
          <Chip
            label="Hesap oluştur"
            onPress={() => navigation.navigate("Register")}
            style={{ alignSelf: "flex-start", marginTop: spacing.md }}
          />
        </Card>
      ) : null}

      {!isAuthenticated ? (
        <Pressable
          onPress={() => navigation.navigate("GuestLimit")}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: SECTION_GAP,
          }}
        >
          <Text style={{ color: colors.text2, fontSize: 13 }}>
            {limitedCount} / {GUEST_LIMIT} abonelik
          </Text>
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>Sınırsız ol</Text>
        </Pressable>
      ) : plan === "free" && limit != null ? (
        <Pressable
          onPress={() => navigation.navigate("Paywall")}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: SECTION_GAP,
          }}
        >
          <Text style={{ color: colors.text2, fontSize: 13 }}>
            {limitedCount} / {limit} abonelik
          </Text>
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>Sınırsız ol</Text>
        </Pressable>
      ) : null}

      <Card noPadding style={{ marginBottom: SECTION_GAP }}>
        <View style={{ padding: spacing.md }}>
          <Text style={{ color: colors.text2, fontSize: 13, fontWeight: "600" }}>
            Aylık toplam
          </Text>
          <Text style={[typography.amountLarge, { color: colors.text, marginTop: 4 }]}>
            {formatTRY(totalTry)}
          </Text>
          <Text style={{ color: colors.text2, fontSize: 13, marginTop: 6 }}>
            {paidSubscriptions.length} abonelik.
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
        <View style={{ marginBottom: SECTION_GAP }}>
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
                  <ServiceLogo
                    domain={item.domain}
                    logoUrl={item.logo_url}
                    name={item.app_name}
                    category={item.category}
                  />
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
        <View style={{ marginBottom: SECTION_GAP }}>
          <Text style={[typography.sectionTitle, { color: colors.text, marginBottom: spacing.sm }]}>
            Kategoriler
          </Text>

          {/* İki eşit sütun: her satırdaki kartlar flex: 1 ile paylaşılır, tek
              kalan kartın yanına boş bir sütun konur ki genişliği değişmesin. */}
          <View style={{ gap: spacing.sm }}>
            {chunkPairs(categoryEntries).map((pair) => (
              <View key={pair[0][0]} style={{ flexDirection: "row", gap: spacing.sm }}>
                {pair.map(([category, total]) => {
                  const percent =
                    categoryGrandTotal > 0 ? (total / categoryGrandTotal) * 100 : 0;

                  return (
                    <Card key={category} style={{ flex: 1 }}>
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
                {pair.length === 1 ? <View style={{ flex: 1 }} /> : null}
              </View>
            ))}
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
          <View style={{ gap: SECTION_GAP }}>
            {listedSubscriptions.length > 0 ? (
              <GroupedList>{listedSubscriptions.map(renderSubscriptionRow)}</GroupedList>
            ) : null}
            {othersPay.length > 0 ? (
              <View>
                <Text style={{ fontFamily: fontFamily.bold, fontSize: 17, color: colors.text }}>
                  Başkası ödüyor
                </Text>
                <Text style={{ color: colors.text2, fontSize: 13, marginTop: 2, marginBottom: spacing.sm }}>
                  Toplamlara ve hatırlatmalara katılmaz.
                </Text>
                <GroupedList>{othersPay.map(renderSubscriptionRow)}</GroupedList>
              </View>
            ) : null}
            {cancelledSubscriptions.length > 0 ? (
              <View>
                <Text style={{ fontFamily: fontFamily.bold, fontSize: 17, color: colors.text }}>
                  İptal edilenler
                </Text>
                <Text style={{ color: colors.text2, fontSize: 13, marginTop: 2, marginBottom: spacing.sm }}>
                  Toplamlara, hatırlatmalara ve abonelik sınırına katılmaz.
                </Text>
                <GroupedList>{cancelledSubscriptions.map(renderCancelledRow)}</GroupedList>
              </View>
            ) : null}
          </View>
        )}
      </View>

      {isAuthenticated ? (
        <KivirikQuestionSheet visible={questionsOpen} token={token} onClose={handleQuestionsClose} />
      ) : null}

      <BillingDaySheet
        items={billingFlowItems}
        onSave={saveBillingDay}
        onClose={() => {
          setBillingFlowItems(null);
          rescheduleAll(subscriptions);
          if (subscriptions.some(hasBillingDay)) {
            maybeAskForReminders();
          }
        }}
      />
    </ScrollView>
  );
}

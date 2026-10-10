import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as api from "../api/client";
import {
  BillingDaySheet,
  CancelGuideSheet,
  Card,
  CategoryTag,
  GroupedList,
  GroupedListRow,
  KivirikHead,
  KivirikQuestionSheet,
  PillButton,
  ServiceLogo,
} from "../components";
import { formatIsoDate } from "../components/KivirikQuestionCard";
import { paymentChannelLabel, shareLabel } from "../config/subscriptionFields";
import { useAuth } from "../context/AuthContext";
import { maybeAskForReminders, rescheduleAll } from "../services/reminders";
import { refreshKivirikCount } from "../services/kivirik";
import { isManagedInactive, loadSubscriptions } from "../services/subscriptionsSource";
import { removeGuestSubscription, updateGuestSubscription } from "../storage/guestSubscriptions";
import { fontFamily, useTheme } from "../theme";
import { formatBillingDay, periodLabel } from "../utils/billing";
import { formatAmount, formatSubscriptionPrice, formatTRY } from "../utils/price";

const APP_STORE_SUBSCRIPTIONS_URL = "https://apps.apple.com/account/subscriptions";

// Düzenlenebilir bilgi satırı: solda etiket, sağda değer (ve alt satır).
function EditableRow({ label, value, detail, action = "›", onPress }) {
  const { colors, spacing } = useTheme();

  return (
    <GroupedListRow onPress={onPress} style={{ justifyContent: "space-between" }}>
      <Text style={{ color: colors.text2 }}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, flexShrink: 1 }}>
        <View style={{ alignItems: "flex-end", flexShrink: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "600", textAlign: "right" }}>{value}</Text>
          {detail ? (
            <Text style={{ color: colors.text2, fontSize: 12.5, marginTop: 1, textAlign: "right" }}>
              {detail}
            </Text>
          ) : null}
        </View>
        <Text
          style={{
            color: action === "›" ? colors.text2 : colors.text,
            fontSize: action === "›" ? 18 : 13.5,
            fontWeight: action === "›" ? "400" : "700",
          }}
        >
          {action}
        </Text>
      </View>
    </GroupedListRow>
  );
}

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
  // "İptal ettim" / "Geri al" isteği sürerken.
  const [statusBusy, setStatusBusy] = useState(false);
  // Tek alan düzenleme (Kıvırık kartı) ve ortak iptal rehberi.
  const [editing, setEditing] = useState(null);
  const [cancelGuideOpen, setCancelGuideOpen] = useState(false);

  // erişte Premium: fiyat App Store'dan gelir, iptal App Store'da yapılır,
  // Premium bitince kayıt kalır ama "aktif değil" görünür.
  const isManaged = Boolean(subscription.managed_by);
  const managedInactive = isManagedInactive(subscription);
  // "İptal ettim" yalnızca hesapta ve uygulamanın yönetmediği kayıtlarda.
  const canMarkCancelled = !isGuest && !isManaged;
  const isCancelled = Boolean(subscription.cancelled_at);
  const cancelUrl = isManaged
    ? catalogItem?.cancel_url ?? APP_STORE_SUBSCRIPTIONS_URL
    : catalogItem?.cancel_url;

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

  // erişte doğrudan App Store'a; diğerleri ödeme kanalına göre rehberle.
  function handleCancel() {
    if (isManaged) {
      Linking.openURL(cancelUrl);
      return;
    }
    setCancelGuideOpen(true);
  }

  function editField(key, initialInput = null) {
    setEditing({
      question: { key, user_subscription_id: subscription.id, period: "once", params: subscription },
      initialInput,
    });
  }

  // Düzenleme sonrası satırı sunucudan tazeler (toplamlar, kişi başı tutar).
  async function reloadSubscription() {
    try {
      const fresh = (await loadSubscriptions(token)).find((item) => item.id === subscription.id);
      if (fresh) {
        setSubscription(fresh);
      }
    } catch (err) {
      // Ekran eski veriyle kalır; Ana sayfa odaklanınca yenilenir.
    }
    refreshKivirikCount(token, { force: true });
  }

  function handleEditClose({ changed }) {
    setEditing(null);
    if (changed) {
      reloadSubscription();
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

  // İptal işareti değişince toplamlar, hatırlatmalar ve Kıvırık soruları
  // yeniden hesaplanır.
  async function setCancelled(cancelled) {
    setStatusBusy(true);
    try {
      const result = cancelled
        ? await api.cancelUserSubscription(token, subscription.id)
        : await api.restoreUserSubscription(token, subscription.id);
      setSubscription((current) => ({ ...current, cancelled_at: result.cancelled_at }));
      rescheduleAll();
      refreshKivirikCount(token, { force: true });
    } catch (err) {
      if (err.code === "LIMIT_REACHED") {
        navigation.navigate("Paywall");
      } else {
        Alert.alert("Kaydedilemedi", err.message);
      }
    } finally {
      setStatusBusy(false);
    }
  }

  function handleCancelledPress() {
    Alert.alert(
      "İptal ettin mi?",
      "Toplamlardan, hatırlatmalardan ve abonelik sınırından çıkar; listende \"İptal edilenler\" altında kalır. Ödeme gününden sonra çekim olup olmadığını sorarım.",
      [
        { text: "Vazgeç", style: "cancel" },
        { text: "İptal ettim", onPress: () => setCancelled(true) },
      ]
    );
  }

  function handleRemovePress() {
    Alert.alert(
      "Aboneliği sil",
      isManaged
        ? `${subscription.app_name} listenden silinsin mi? Premium aboneliğin iptal olmaz ve bu kayıt listene tekrar eklenmez.`
        : canMarkCancelled && !isCancelled
          ? `${subscription.app_name} listenden silinsin mi? Yanlışlıkla eklediysen sil. Servisten iptal ettiysen "İptal ettim"i kullan.`
          : `${subscription.app_name} listenden silinsin mi? Bu işlem servisteki aboneliğini iptal etmez.`,
      [
        { text: "Vazgeç", style: "cancel" },
        { text: "Sil", style: "destructive", onPress: removeSubscription },
      ]
    );
  }

  const price = formatSubscriptionPrice(subscription);
  const priceHistory = catalogItem?.price_history || [];
  const shareCount = subscription.share_count ?? null;
  const priceTry = Number(subscription.current_price_try ?? subscription.current_price ?? 0);
  const yourPrice =
    subscription.custom_price != null
      ? formatAmount(subscription.custom_price, subscription.custom_currency ?? subscription.currency)
      : formatAmount(subscription.catalog_price ?? subscription.current_price, subscription.catalog_currency ?? subscription.currency);
  const trialValue = subscription.is_trial
    ? subscription.trial_ends_at
      ? `Evet, ${formatIsoDate(subscription.trial_ends_at)}`
      : "Evet"
    : subscription.is_trial === false
      ? "Hayır"
      : "—";

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
        {isCancelled ? (
          <View
            style={{
              alignSelf: "flex-start",
              backgroundColor: colors.field,
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 4,
              marginTop: spacing.sm,
            }}
          >
            <Text style={{ fontSize: 12.5, fontWeight: "700", color: colors.text2 }}>
              İptal edildi · {new Date(subscription.cancelled_at).toLocaleDateString("tr-TR")}
            </Text>
          </View>
        ) : null}
        {managedInactive ? (
          <View
            style={{
              alignSelf: "flex-start",
              backgroundColor: colors.field,
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 4,
              marginTop: spacing.sm,
            }}
          >
            <Text style={{ fontSize: 12.5, fontWeight: "700", color: colors.text2 }}>
              Premium aktif değil
            </Text>
          </View>
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
      ) : !isManaged ? (
        <GroupedList style={{ marginBottom: spacing.lg }}>
          <EditableRow
            label="Ödeme kanalı"
            value={paymentChannelLabel(subscription.payment_channel) ?? "Ekle"}
            onPress={() => editField("payment_channel")}
          />
          <EditableRow
            label="Senin ödediğin"
            value={yourPrice}
            detail={subscription.custom_price == null ? "Katalog fiyatı" : null}
            action="Değiştir"
            onPress={() => editField("price_confirm", "amount")}
          />
          <EditableRow
            label="Paylaşım"
            value={shareCount == null ? "—" : shareLabel(shareCount)}
            detail={shareCount > 1 ? `Kişi başı ${formatTRY(priceTry / shareCount)}` : null}
            onPress={() => editField("share_count")}
          />
          <EditableRow label="Ücretsiz deneme" value={trialValue} onPress={() => editField("is_trial")} />
          <EditableRow
            label="Planlı bırakma"
            value={subscription.planned_end_at ? formatIsoDate(subscription.planned_end_at) : "—"}
            onPress={() => editField("planned_end")}
          />
          <EditableRow
            label="Kullanım sıklığı"
            value={subscription.usage_frequency || "—"}
            onPress={() => editField("usage_frequency")}
          />
          <EditableRow label="Neden" value={subscription.reason || "—"} onPress={() => editField("reason")} />
        </GroupedList>
      ) : null}

      {/* erişte Premium'un fiyatı App Store'dan gelir; katalog fiyat geçmişi yok. */}
      {!isManaged ? (
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
      ) : null}

      {isCancelled ? (
        <View>
          <PillButton
            title="Geri al"
            variant="outline"
            loading={statusBusy}
            disabled={statusBusy}
            onPress={() => setCancelled(false)}
          />
          <Text style={{ color: colors.text2, fontSize: 12, textAlign: "center", marginTop: spacing.sm }}>
            Toplamlara ve hatırlatmalara katılmıyor
          </Text>
        </View>
      ) : (isManaged ? cancelUrl && !managedInactive : true) ? (
        <View>
          <PillButton
            title={isManaged ? "İptal et" : "Aboneliği iptal et"}
            variant="danger"
            onPress={handleCancel}
          />
          <Text style={{ color: colors.text2, fontSize: 12, textAlign: "center", marginTop: spacing.sm }}>
            {isManaged
              ? "App Store abonelik yönetimi açılır"
              : "Nereden ödediğine göre doğru yere götürürüm"}
          </Text>
          {canMarkCancelled ? (
            <PillButton
              title="İptal ettim"
              variant="outline"
              loading={statusBusy}
              disabled={statusBusy}
              onPress={handleCancelledPress}
              style={{ marginTop: spacing.md }}
            />
          ) : null}
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
            Sil
          </Text>
        )}
      </Pressable>

      {!isGuest ? (
        <KivirikQuestionSheet
          visible={Boolean(editing)}
          token={token}
          editQuestion={editing}
          onClose={handleEditClose}
        />
      ) : null}

      <CancelGuideSheet
        visible={cancelGuideOpen}
        subscription={subscription}
        cancelUrl={catalogItem?.cancel_url ?? null}
        token={isGuest ? null : token}
        onClose={() => setCancelGuideOpen(false)}
        onChannelSaved={(channel) => setSubscription((current) => ({ ...current, payment_channel: channel }))}
      />

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

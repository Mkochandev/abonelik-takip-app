import { useState } from "react";
import { Alert, Linking, Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as api from "../api/client";
import { fontFamily, useTheme } from "../theme";
import { KivirikHead } from "./brand";
import { KivirikQuestionCard } from "./KivirikQuestionCard";
import { PillButton } from "./PillButton";

const APP_STORE_URL = "https://apps.apple.com/account/subscriptions";
const GOOGLE_PLAY_URL = "https://play.google.com/store/account/subscriptions";

// Ödeme kanalına göre iptal yolu: { text, action?: { label, url } }.
// Servis adına ek getirilmez.
export function cancelGuideFor(channel, cancelUrl) {
  switch (channel) {
    case "app_store":
      return {
        text: "App Store'dan ödüyorsun. İptal, App Store'daki abonelikler sayfasından yapılır.",
        action: { label: "App Store aboneliklerini aç", url: APP_STORE_URL },
      };
    case "google_play":
      return {
        text: "Google Play'den ödüyorsun. İptal, Google Play'deki abonelikler sayfasından yapılır.",
        action: { label: "Google Play aboneliklerini aç", url: GOOGLE_PLAY_URL },
      };
    case "web_card":
      return cancelUrl
        ? {
            text: "Sitesinden kartla ödüyorsun. İptal sayfasını senin için açarım.",
            action: { label: "İptal sayfasını aç", url: cancelUrl },
          }
        : {
            text: "Sitesinden kartla ödüyorsun. Bu servisin iptal sayfası bende yok; sitedeki hesap ayarlarından iptal edebilirsin.",
          };
    case "operator":
      return { text: "Operatörünün uygulamasından veya müşteri hizmetlerinden iptal edebilirsin." };
    case "someone_else":
      return { text: "Bunu başkası ödüyor. İptal için ödeyen kişiye haber verebilirsin." };
    default:
      return null;
  }
}

// Rehberin içeriği (panel kabı olmadan): Kıvırık soru panelinde de
// kullanılır. Kanal bilinmiyorsa önce kanalı sorar.
export function CancelGuideContent({ subscription, cancelUrl, token, onClose, onChannelSaved }) {
  const { colors, isDark } = useTheme();
  const [channel, setChannel] = useState(subscription.payment_channel ?? null);
  const [busy, setBusy] = useState(false);
  const guide = cancelGuideFor(channel, cancelUrl);

  // Kanal bilinmiyorsa önce sorulur; hesaplı kullanıcıda cevap kaydedilir.
  async function saveChannel({ answer }) {
    if (!token) {
      setChannel(answer);
      return;
    }
    setBusy(true);
    try {
      await api.answerKivirikQuestion(token, {
        key: "payment_channel",
        user_subscription_id: subscription.id,
        period: "once",
        answer,
      });
      setChannel(answer);
      onChannelSaved?.(answer);
    } catch (err) {
      Alert.alert("Kaydedilemedi", err.message);
    } finally {
      setBusy(false);
    }
  }

  return guide ? (
    <>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
        <KivirikHead size={64} mood="dusunceli" />
        <View
          style={{
            flex: 1,
            backgroundColor: isDark ? "#26232D" : "#15131A",
            borderRadius: 20,
            borderBottomLeftRadius: 6,
            paddingVertical: 14,
            paddingHorizontal: 16,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "700", color: "#FFC53D" }}>Kıvırık</Text>
          <Text
            style={{
              marginTop: 2,
              fontFamily: fontFamily.bold,
              fontSize: 17,
              lineHeight: 23,
              color: "#F5F3F7",
            }}
          >
            {guide.text}
          </Text>
        </View>
      </View>
      <View style={{ gap: 10 }}>
        {guide.action ? (
          <PillButton
            title={guide.action.label}
            onPress={() => {
              Linking.openURL(guide.action.url).catch(() => {});
              onClose();
            }}
          />
        ) : null}
        <PillButton
          title="Nereden ödediğimi değiştir"
          variant="outline"
          onPress={() => setChannel(null)}
        />
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          style={{ height: 44, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text2 }}>Kapat</Text>
        </Pressable>
      </View>
    </>
  ) : (
    // Kart seçenekleri kaydırılabilir alanda; kap yüksekliği sabit değilse
    // (kendi paneli) en az bu kadar yer açılır.
    <View style={{ flex: 1, minHeight: 560 }}>
      <KivirikQuestionCard
        question={{
          key: "payment_channel",
          user_subscription_id: subscription.id,
          period: "once",
          params: subscription,
        }}
        busy={busy}
        onAnswer={saveChannel}
        hideFooter
      />
    </View>
  );
}

function GuideBody({ onClose, ...props }) {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: "flex-end" }}>
      <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Kapat" />
      <View
        style={{
          maxHeight: "92%",
          backgroundColor: colors.card,
          borderTopLeftRadius: radius.sheet,
          borderTopRightRadius: radius.sheet,
          paddingTop: 10,
          paddingHorizontal: 20,
          paddingBottom: Math.max(34, insets.bottom + spacing.md),
          gap: 18,
        }}
      >
        <View
          style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: colors.divider, alignSelf: "center" }}
        />
        <CancelGuideContent {...props} onClose={onClose} />
      </View>
    </View>
  );
}

// Ortak iptal rehberi: ödeme kanalına göre doğru yere götürür; kanal boşsa
// önce sorar. Detay ekranındaki iptal butonu ve Kıvırık'ın iptal
// cevapları bunu kullanır. Misafirde kanal kaydedilmez, yalnızca yol
// gösterilir.
export function CancelGuideSheet({ visible, subscription, cancelUrl, token, onClose, onChannelSaved }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {visible && subscription ? (
        <GuideBody
          subscription={subscription}
          cancelUrl={cancelUrl}
          token={token}
          onClose={onClose}
          onChannelSaved={onChannelSaved}
        />
      ) : null}
    </Modal>
  );
}

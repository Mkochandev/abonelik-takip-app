import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card, KivirikBubble, KivirikHead, PillButton } from "../components";
import { fontFamily, useTheme } from "../theme";

const APPLE_REPORT_URL = "https://reportaproblem.apple.com";
const GOOGLE_PLAY_ORDERS_URL = "https://play.google.com/store/account/orderhistory";
const E_DEVLET_URL = "https://www.turkiye.gov.tr";

// İlk adım: ödemenin geçtiği yerden iade istemek (kanala göre).
// { text, action?: { label, url } }. Servis adına ek getirilmez.
function platformStep(channel, cancelUrl) {
  switch (channel) {
    case "app_store":
      return {
        text: "Apple'ın \"Sorun bildir\" sayfasında bu çekimi seçip iade isteyebilirsin.",
        action: { label: "Sorun bildir sayfasını aç", url: APPLE_REPORT_URL },
      };
    case "google_play":
      return {
        text: "Google Play sipariş geçmişinde bu çekimi bulup \"Sorun bildir\" ile iade isteyebilirsin.",
        action: { label: "Sipariş geçmişini aç", url: GOOGLE_PLAY_ORDERS_URL },
      };
    case "web_card":
      return {
        text: "Servisin müşteri hizmetlerine yaz: iptal ettiğini ve yine de çekim yapıldığını anlat, iptal onayın varsa ekle.",
        action: cancelUrl ? { label: "Hesap sayfasını aç", url: cancelUrl } : null,
      };
    case "operator":
      return {
        text: "Operatörünün uygulamasından ya da müşteri hizmetlerinden bu ücrete itiraz edebilirsin.",
      };
    default:
      return {
        text: "Ücreti aldığın yere başvur: App Store, Google Play, operatörün ya da servisin kendisi.",
      };
  }
}

function Step({ number, title, text, action }) {
  const { colors, spacing, brand } = useTheme();

  return (
    <Card>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: brand.safran,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontFamily: fontFamily.extraBold, fontSize: 16, color: brand.ink }}>{number}</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontFamily: fontFamily.bold, fontSize: 17, color: colors.text }}>{title}</Text>
          <Text style={{ fontSize: 15, lineHeight: 21, color: colors.text2 }}>{text}</Text>
        </View>
      </View>
      {action ? (
        <PillButton
          title={action.label}
          variant="outline"
          onPress={() => Linking.openURL(action.url).catch(() => {})}
          style={{ marginTop: spacing.md }}
        />
      ) : null}
    </Card>
  );
}

// İptal sonrası çekim olduysa (cancel_verify "Evet") gösterilen sabit
// rehber. Bilgilendirme amaçlıdır; hukuki tavsiye gibi yazılmaz.
// params: { subscription } (payment_channel, cancel_url, app_name)
export default function RefundStepsScreen({ navigation, route }) {
  const { subscription = {} } = route.params ?? {};
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const first = platformStep(subscription.payment_channel, subscription.cancel_url);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        padding: spacing.md,
        paddingTop: insets.top + spacing.sm,
        paddingBottom: insets.bottom + spacing.lg,
        gap: spacing.md,
      }}
    >
      <Pressable
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Geri"
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: colors.card,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 20, color: colors.text }}>‹</Text>
      </Pressable>

      <View>
        <Text
          accessibilityRole="header"
          style={{ fontFamily: fontFamily.extraBold, fontSize: 30, letterSpacing: -0.8, color: colors.text }}
        >
          İade adımları
        </Text>
        {subscription.app_name ? (
          <Text style={{ color: colors.text2, fontSize: 15, marginTop: 2 }}>{subscription.app_name}</Text>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing.sm }}>
        <KivirikHead size={56} mood="dusunceli" />
        <KivirikBubble tail="left" style={{ flex: 1 }}>
          <Text style={{ color: "#F5F3F7", fontSize: 15, fontWeight: "600", lineHeight: 21 }}>
            İptal ettiğin halde çekim olduysa sırayla şunları deneyebilirsin.
          </Text>
        </KivirikBubble>
      </View>

      <Step number={1} title="Önce ödediğin yerden iade iste" text={first.text} action={first.action} />
      <Step
        number={2}
        title="Olmazsa bankana itiraz et"
        text="Bankanın uygulamasından ya da müşteri hizmetlerinden bu harcama için itiraz başlatabilirsin. İptal onayın ve hesap dökümün işini kolaylaştırır."
      />
      <Step
        number={3}
        title="O da olmazsa Tüketici Hakem Heyeti"
        text={"e-Devlet'te \"Tüketici Şikayeti\" hizmetini aratıp Tüketici Hakem Heyeti'ne başvurabilirsin."}
        action={{ label: "e-Devlet'i aç", url: E_DEVLET_URL }}
      />

      <Text style={{ fontSize: 13, lineHeight: 18, color: colors.text2, textAlign: "center" }}>
        Bunlar genel bilgiler; servislerin ve bankaların süreçleri farklı olabilir.
      </Text>
    </ScrollView>
  );
}

import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fontFamily, useTheme } from "../theme";
import { isYearly, periodLabel } from "../utils/billing";
import { formatSubscriptionPrice } from "../utils/price";
import { BillingDayPicker } from "./BillingDayPicker";
import { KivirikBubble, KivirikHead } from "./brand";
import { PillButton } from "./PillButton";
import { ServiceLogo } from "./ServiceLogo";

const REASON_OPTIONS = {
  "Video/Dizi-Film": [
    "Belirli bir dizi/film için",
    "Genel eğlence takibi",
    "Aile/ev arkadaşıyla ortak",
    "Spor/belgesel içerikleri",
  ],
  Müzik: ["Günlük müzik dinleme", "Playlist/podcast takibi", "Reklamsız dinleme", "Offline indirme"],
  "Kitap/Sesli Kitap": [
    "Belirli bir kitap/seri için",
    "Düzenli okuma alışkanlığı",
    "Yolda/işte dinleme",
  ],
  "Yapay Zeka": ["İş/proje için", "Kod yazarken yardım", "Öğrenme/araştırma", "Kişisel kullanım"],
  "Bulut Depolama": [
    "Fotoğraf/video yedekleme",
    "Cihazlar arası senkronizasyon",
    "İş dosyaları için",
  ],
  "Üretkenlik/Tasarım": ["İş projeleri için", "Freelance/müşteri işleri", "Kişisel hobi", "Okul/eğitim"],
  Spor: ["Maç takibi", "Belirli bir takım/lig için", "Genel spor içerikleri"],
};

// value, veritabanındaki usage_frequency kısıtına uyan değerdir.
const USAGE_FREQUENCIES = [
  { label: "Her gün", value: "Her gün" },
  { label: "Haftada birkaç", value: "Haftada birkaç" },
  { label: "Nadiren, aslında unuttum", value: "Nadiren" },
];

const STEP_COUNT = 3;

function OptionButton({ label, selected, onPress, style }) {
  const { colors, isDark } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        {
          minHeight: 52,
          borderRadius: 18,
          borderWidth: 2,
          borderColor: selected ? colors.text : "transparent",
          backgroundColor: selected ? (isDark ? "#2E2716" : "#FFF6DC") : colors.field,
          paddingHorizontal: 16,
          justifyContent: "center",
          opacity: pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text }}>{label}</Text>
    </Pressable>
  );
}

function ProgressDots({ step }) {
  const { colors } = useTheme();

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: STEP_COUNT, now: step + 1 }}
      style={{ flexDirection: "row", gap: 4 }}
    >
      {Array.from({ length: STEP_COUNT }, (_, index) => (
        <View
          key={index}
          style={{
            width: index === step ? 18 : 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: index === step ? colors.text : colors.divider,
          }}
        />
      ))}
    </View>
  );
}

function SheetContent({ plan, isGuest, onClose, onSubmit, onCreateAccount }) {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [selectedReason, setSelectedReason] = useState(null);
  const [reasonText, setReasonText] = useState("");
  const [usageFrequency, setUsageFrequency] = useState(null);
  const [billing, setBilling] = useState({ day: null, month: null });

  const yearly = isYearly(plan);
  const price = formatSubscriptionPrice(plan);
  const reasonOptions = REASON_OPTIONS[plan.category] || [];
  const isLastStep = step === STEP_COUNT - 1;

  const questions = [
    // Uygulama adına ek getirilmez; okunuşu belirsiz yabancı adlarda yanlış
    // ek seçmemek için eksiz kalıplar kullanılır.
    `${plan.app_name} — ne için kullanıyorsun?`,
    "Ne sıklıkla kullanıyorsun?",
    yearly ? "Yılın hangi günü ödüyorsun?" : "Ayın kaçında ödüyorsun?",
  ];

  function handleReasonPress(label) {
    if (selectedReason === label) {
      setSelectedReason(null);
      setReasonText((current) => (current === label ? "" : current));
    } else {
      setSelectedReason(label);
      setReasonText(label);
    }
  }

  function handleReasonTextChange(text) {
    setReasonText(text);
    if (selectedReason && text !== selectedReason) {
      setSelectedReason(null);
    }
  }

  function clearCurrentStep() {
    if (step === 0) {
      setSelectedReason(null);
      setReasonText("");
    } else if (step === 1) {
      setUsageFrequency(null);
    } else {
      setBilling({ day: null, month: null });
    }
  }

  // overrides: "Geç" ile son adım boş bırakıldığında state güncellenmeden
  // kaydedilebilsin diye.
  function save(overrides = {}) {
    const value = overrides.billing ?? billing;

    if (yearly && value.day && !value.month) {
      Alert.alert("Ay eksik", "Yıllık plan için ödeme ayını da seç ya da bu adımı geç.");
      return;
    }

    onSubmit({
      reason: reasonText.trim() || null,
      usage_frequency: usageFrequency,
      billing_date: value.day,
      billing_month: yearly && value.day ? value.month : null,
    });
  }

  function handleSkip() {
    clearCurrentStep();
    if (isLastStep) {
      save({ billing: { day: null, month: null } });
    } else {
      setStep(step + 1);
    }
  }

  function handleNext() {
    if (isLastStep) {
      save();
    } else {
      setStep(step + 1);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: "flex-end" }}
    >
      <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Kapat" />

      <View
        style={{
          height: 640,
          maxHeight: "92%",
          backgroundColor: colors.card,
          borderTopLeftRadius: radius.sheet,
          borderTopRightRadius: radius.sheet,
          paddingTop: spacing.sm + 2,
          paddingHorizontal: spacing.lg,
          paddingBottom: Math.max(spacing.lg, insets.bottom + spacing.sm),
        }}
      >
        <View
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.divider,
            alignSelf: "center",
            marginBottom: spacing.md,
          }}
        />

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            backgroundColor: colors.bg,
            borderRadius: 18,
            padding: 12,
          }}
        >
          <ServiceLogo
            domain={plan.domain}
            logoUrl={plan.logo_url}
            name={plan.app_name}
            category={plan.category}
            size={40}
          />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }} numberOfLines={1}>
              {plan.app_name} {plan.plan_name}
            </Text>
            <Text style={{ fontFamily: fontFamily.bold, fontSize: 14, color: colors.text2, marginTop: 2 }}>
              {price.primary} {periodLabel(plan)}
            </Text>
          </View>
          <ProgressDots step={step} />
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            gap: spacing.sm,
            marginTop: spacing.lg,
            marginBottom: spacing.md,
          }}
        >
          <KivirikHead size={68} />
          <KivirikBubble tail="left" style={{ flex: 1 }}>
            <Text style={{ fontFamily: fontFamily.extraBold, fontSize: 19, lineHeight: 24, color: "#F5F3F7" }}>
              {questions[step]}
            </Text>
          </KivirikBubble>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.md }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 0 ? (
            <>
              {isGuest ? (
                <Text
                  onPress={onCreateAccount}
                  accessibilityRole="link"
                  style={{
                    color: colors.text,
                    fontWeight: "600",
                    fontSize: 13.5,
                    textDecorationLine: "underline",
                    marginBottom: spacing.xs,
                  }}
                >
                  Cevaplarını saklamak için hesap oluştur
                </Text>
              ) : null}
              {reasonOptions.map((label) => (
                <OptionButton
                  key={label}
                  label={label}
                  selected={selectedReason === label}
                  onPress={() => handleReasonPress(label)}
                />
              ))}
              <TextInput
                style={{
                  backgroundColor: colors.field,
                  borderRadius: 18,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  fontSize: 15,
                  color: colors.text,
                  minHeight: 52,
                  textAlignVertical: "top",
                }}
                placeholder="Ya da kendi cevabını yaz..."
                placeholderTextColor={colors.text2}
                value={reasonText}
                onChangeText={handleReasonTextChange}
                multiline
              />
            </>
          ) : null}

          {step === 1
            ? USAGE_FREQUENCIES.map(({ label, value }) => (
                <OptionButton
                  key={value}
                  label={label}
                  selected={usageFrequency === value}
                  onPress={() => setUsageFrequency((current) => (current === value ? null : value))}
                />
              ))
            : null}

          {step === 2 ? (
            <>
              <BillingDayPicker
                yearly={yearly}
                day={billing.day}
                month={billing.month}
                onChange={setBilling}
              />
              <Text style={{ color: colors.text2, fontSize: 13.5, marginTop: spacing.xs }}>
                Ödeme günü yaklaşınca ana sayfada hatırlatırım.
              </Text>
            </>
          ) : null}
        </ScrollView>

        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <PillButton title="Geç" variant="outline" onPress={handleSkip} style={{ flex: 1 }} />
          <PillButton
            title={isLastStep ? "Kaydet" : "Devam"}
            variant={isLastStep ? "accent" : "primary"}
            onPress={handleNext}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// Plan seçildikten sonra açılan, Kıvırık'ın adım adım sorduğu ekleme sayfası.
// onSubmit({ reason, usage_frequency, billing_date, billing_month }) ile
// biter; misafirde yalnızca ödeme günü yerel listede saklanır.
export function AddSubscriptionSheet({ plan, isGuest, onClose, onSubmit, onCreateAccount }) {
  return (
    <Modal visible={plan !== null} transparent animationType="slide" onRequestClose={onClose}>
      {plan ? (
        <SheetContent
          key={plan.id}
          plan={plan}
          isGuest={isGuest}
          onClose={onClose}
          onSubmit={onSubmit}
          onCreateAccount={onCreateAccount}
        />
      ) : null}
    </Modal>
  );
}

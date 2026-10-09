import { useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fontFamily, useTheme } from "../theme";
import { isYearly } from "../utils/billing";
import { BillingDayPicker } from "./BillingDayPicker";
import { KivirikBubble, KivirikHead } from "./brand";
import { PillButton } from "./PillButton";
import { ServiceLogo } from "./ServiceLogo";

// Uygulama adına ek getirilmez (bkz. AddSubscriptionSheet).
export function billingQuestion(item) {
  return isYearly(item)
    ? `${item.app_name} — ödemesi yılın hangi günü çıkıyor?`
    : `${item.app_name} — ödemesi ayın kaçında çıkıyor?`;
}

function SheetContent({ items, onSave, onClose }) {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const item = items[index];
  const yearly = isYearly(item);
  const [value, setValue] = useState({ day: item.billing_date ?? null, month: item.billing_month ?? null });
  const isValid = Boolean(value.day) && (!yearly || Boolean(value.month));
  const isLast = index === items.length - 1;

  function goNext() {
    if (isLast) {
      onClose();
      return;
    }
    const next = items[index + 1];
    setIndex(index + 1);
    setValue({ day: next.billing_date ?? null, month: next.billing_month ?? null });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(item, { billing_date: value.day, billing_month: yearly ? value.month : null });
      goNext();
    } catch (err) {
      Alert.alert("Kaydedilemedi", err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: "flex-end" }}>
      <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Kapat" />

      <View
        style={{
          height: yearly ? 680 : 600,
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
            domain={item.domain}
            logoUrl={item.logo_url}
            name={item.app_name}
            category={item.category}
            size={40}
          />
          <Text style={{ flex: 1, fontSize: 15, fontWeight: "700", color: colors.text }} numberOfLines={1}>
            {item.app_name}
            {item.plan_name ? ` ${item.plan_name}` : ""}
          </Text>
          {items.length > 1 ? (
            <Text style={{ fontFamily: fontFamily.bold, color: colors.text2, fontVariant: ["tabular-nums"] }}>
              {index + 1} / {items.length}
            </Text>
          ) : null}
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
              {billingQuestion(item)}
            </Text>
          </KivirikBubble>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: spacing.md }}
          showsVerticalScrollIndicator={false}
        >
          <BillingDayPicker
            yearly={yearly}
            day={value.day}
            month={value.month}
            onChange={setValue}
          />
        </ScrollView>

        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <PillButton
            title="Bilmiyorum"
            variant="outline"
            onPress={goNext}
            disabled={saving}
            style={{ flex: 1 }}
          />
          <PillButton
            title={isLast ? "Kaydet" : "Kaydet, sonraki"}
            variant={isLast ? "accent" : "primary"}
            onPress={handleSave}
            loading={saving}
            disabled={!isValid}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </View>
  );
}

// Kıvırık'ın ödeme gününü sırayla sorduğu sayfa. items boş/null ise kapalı.
// Her "Kaydet"te onSave(item, { billing_date, billing_month }) beklenir;
// "Bilmiyorum" o kaydı atlar. Son kayıttan sonra ya da dışarı dokununca
// onClose çağrılır.
export function BillingDaySheet({ items, onSave, onClose }) {
  const visible = Boolean(items?.length);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {visible ? <SheetContent key={items[0].id} items={items} onSave={onSave} onClose={onClose} /> : null}
    </Modal>
  );
}

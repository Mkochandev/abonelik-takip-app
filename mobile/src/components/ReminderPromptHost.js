import { useEffect, useState } from "react";
import { Alert, Linking, Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { answerReminderPrompt, setReminderPromptListener } from "../services/reminders";
import { fontFamily, useTheme } from "../theme";
import { KivirikBubble, KivirikHead } from "./brand";
import { PillButton } from "./PillButton";

// Kullanıcı ilk kez ödeme günü girdiğinde Kıvırık'ın sorduğu "haber vereyim
// mi?" sayfası. Uygulamada bir kez, kökte durur; maybeAskForReminders ile
// açılır. Sistem izni yalnızca "Evet"ten sonra istenir.
export function ReminderPromptHost() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => setReminderPromptListener(() => setVisible(true)), []);

  async function answer(accept) {
    setBusy(true);
    try {
      const granted = await answerReminderPrompt(accept);
      setVisible(false);
      if (accept && !granted) {
        Alert.alert(
          "Bildirim izni kapalı",
          "Hatırlatmaları açmak için ayarlardan bildirimlere izin ver.",
          [
            { text: "Vazgeç", style: "cancel" },
            { text: "Ayarlar", onPress: () => Linking.openSettings() },
          ]
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => answer(false)}>
      <View style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: "flex-end" }}>
        <Pressable style={{ flex: 1 }} onPress={() => !busy && answer(false)} accessibilityLabel="Kapat" />
        <View
          style={{
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
              marginBottom: spacing.lg,
            }}
          />

          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing.sm }}>
            <KivirikHead size={68} mood="mutlu" />
            <KivirikBubble tail="left" style={{ flex: 1 }}>
              <Text style={{ fontFamily: fontFamily.extraBold, fontSize: 19, lineHeight: 24, color: "#F5F3F7" }}>
                Ödemeden 1 gün önce haber vereyim mi?
              </Text>
            </KivirikBubble>
          </View>

          <Text style={{ color: colors.text2, fontSize: 13.5, lineHeight: 19, marginTop: spacing.md }}>
            Bildirimi sabah gönderirim (saat 10:00). Profil ekranından kapatabilir ya da kaç gün
            önce geleceğini değiştirebilirsin.
          </Text>

          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg }}>
            <PillButton
              title="Şimdilik hayır"
              variant="outline"
              onPress={() => answer(false)}
              disabled={busy}
              style={{ flex: 1 }}
            />
            <PillButton
              title="Evet, haber ver"
              variant="accent"
              onPress={() => answer(true)}
              loading={busy}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

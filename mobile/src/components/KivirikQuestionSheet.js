import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as api from "../api/client";
import { setKivirikTotal } from "../services/kivirik";
import { rescheduleAll } from "../services/reminders";
import { loadSubscriptions } from "../services/subscriptionsSource";
import { invalidateUserSettings } from "../services/userSettings";
import { fontFamily, useTheme } from "../theme";
import { formatTRY } from "../utils/price";
import { sumCountedMonthlyTry } from "../utils/totals";
import { Kivirik } from "./brand";
import { KivirikQuestionCard } from "./KivirikQuestionCard";
import { PillButton } from "./PillButton";

export const STORE_SUBSCRIPTIONS_URL =
  Platform.OS === "android"
    ? "https://play.google.com/store/account/subscriptions"
    : "https://apps.apple.com/account/subscriptions";

// Cevabın uygulama tarafındaki ek etkileri (veri sunucuda zaten güncellendi).
function afterAnswer(key, answer) {
  if (key === "reminder_days_before" || key === "monthly_budget" || key === "is_student") {
    invalidateUserSettings();
  }
  if (key === "store_check" && answer === "open") {
    Linking.openURL(STORE_SUBSCRIPTIONS_URL).catch(() => {});
  }
}

function SheetBody({ token, editQuestion, onClose }) {
  const { colors, isDark, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const isEdit = Boolean(editQuestion);
  const [phase, setPhase] = useState(isEdit ? "question" : "loading");
  const [questions, setQuestions] = useState(isEdit ? [editQuestion.question] : []);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [changed, setChanged] = useState(false);
  const [monthlyTotal, setMonthlyTotal] = useState(null);

  useEffect(() => {
    if (isEdit) return;
    let active = true;
    api
      .getKivirikQuestions(token)
      .then((data) => {
        if (!active) return;
        setKivirikTotal(data.total);
        setQuestions(data.questions);
        setPhase(data.questions.length > 0 ? "intro" : "empty");
      })
      .catch((err) => active && (setPhase("error"), Alert.alert("Hata", err.message)));
    return () => {
      active = false;
    };
  }, []);

  function close() {
    if (changed) {
      rescheduleAll();
    }
    onClose({ changed });
  }

  async function finish() {
    if (isEdit) {
      onClose({ changed: true });
      rescheduleAll();
      return;
    }
    setPhase("done");
    try {
      setMonthlyTotal(sumCountedMonthlyTry(await loadSubscriptions(token)));
    } catch (err) {
      setMonthlyTotal(null);
    }
  }

  function next() {
    if (index + 1 < questions.length) {
      setIndex(index + 1);
    } else {
      finish();
    }
  }

  async function run(request) {
    setBusy(true);
    try {
      const result = await request();
      setKivirikTotal(result.total);
      setChanged(true);
      next();
    } catch (err) {
      Alert.alert("Kaydedilemedi", err.message);
    } finally {
      setBusy(false);
    }
  }

  const question = questions[index];

  function answer({ answer: value, value: extra }) {
    run(async () => {
      const result = await api.answerKivirikQuestion(token, {
        key: question.key,
        user_subscription_id: question.user_subscription_id,
        period: question.period,
        answer: value,
        value: extra,
      });
      afterAnswer(question.key, value);
      return result;
    });
  }

  function dismiss(mode) {
    run(() =>
      api.dismissKivirikQuestion(token, {
        key: question.key,
        user_subscription_id: question.user_subscription_id,
        mode,
      })
    );
  }

  const bowl = isDark ? "krem" : "gece";
  const isQuestion = phase === "question" && question;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: "flex-end" }}
    >
      <Pressable style={{ flex: 1 }} onPress={close} accessibilityLabel="Kapat" />
      <View
        accessibilityViewIsModal
        style={{
          height: isQuestion ? 660 : undefined,
          minHeight: isQuestion ? undefined : 560,
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

        {phase === "loading" ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : null}

        {phase === "intro" ? (
          <>
            <View style={{ alignItems: "center", gap: 14, paddingTop: 6 }}>
              <Kivirik size={150} mood="heyecanli" bowl={bowl} />
              <Text
                accessibilityRole="header"
                style={{
                  fontFamily: fontFamily.extraBold,
                  fontSize: 28,
                  letterSpacing: -0.8,
                  lineHeight: 31,
                  color: colors.text,
                  textAlign: "center",
                }}
              >
                Dur, sana soracaklarım var!
              </Text>
              <Text
                style={{ fontSize: 15, lineHeight: 22, color: colors.text2, textAlign: "center", maxWidth: 290 }}
              >
                {questions.length} kısa soru, tek dokunuşla. Cevapların hatırlatmaları ve önerilerimi
                daha isabetli yapar.
              </Text>
            </View>
            <View style={{ marginTop: "auto", gap: 10 }}>
              <PillButton title="Başlayalım" onPress={() => setPhase("question")} />
              <Pressable
                onPress={close}
                accessibilityRole="button"
                style={{ height: 48, alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text2 }}>Şimdi değil</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        {isQuestion ? (
          <KivirikQuestionCard
            key={`${question.key}-${question.user_subscription_id ?? "user"}-${index}`}
            question={question}
            index={index}
            count={questions.length}
            busy={busy}
            onAnswer={answer}
            onSkip={() => dismiss("later")}
            onNever={() => dismiss("never")}
            initialInput={editQuestion?.initialInput ?? null}
            hideFooter={isEdit}
          />
        ) : null}

        {phase === "done" || phase === "empty" ? (
          <>
            <View style={{ alignItems: "center", gap: 14, paddingTop: 6 }}>
              <Kivirik size={150} mood="mutlu" bowl={bowl} />
              <Text
                accessibilityRole="header"
                style={{
                  fontFamily: fontFamily.extraBold,
                  fontSize: 28,
                  letterSpacing: -0.8,
                  color: colors.text,
                  textAlign: "center",
                }}
              >
                {phase === "empty" ? "Şimdilik sorum yok!" : "Şimdilik bu kadar!"}
              </Text>
              {phase === "done" && monthlyTotal != null ? (
                <View
                  style={{ alignSelf: "stretch", backgroundColor: colors.bg, borderRadius: 20, padding: 16, gap: 4 }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text2 }}>
                    Bu ay aboneliklere ödeyeceğin
                  </Text>
                  <Text
                    style={{
                      fontFamily: fontFamily.extraBold,
                      fontSize: 34,
                      letterSpacing: -1,
                      fontVariant: ["tabular-nums"],
                      color: colors.text,
                    }}
                  >
                    {formatTRY(monthlyTotal)}
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.text2 }}>
                    Yeni bir şey olunca rozetle haber veririm.
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={{ marginTop: "auto" }}>
              <PillButton title="Tamam" onPress={close} />
            </View>
          </>
        ) : null}

        {phase === "error" ? (
          <View style={{ marginTop: "auto" }}>
            <PillButton title="Kapat" variant="outline" onPress={close} />
          </View>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

// Kıvırık'ın soru paneli (K2): giriş → en fazla 3 soru → bitiş.
// editQuestion verilirse ({ question, initialInput }) yalnızca o soru
// gösterilir (detay ekranından tek alan düzenleme); giriş/bitiş yok.
// onClose({ changed }) — bir şey cevaplandıysa changed true.
export function KivirikQuestionSheet({ visible, token, editQuestion = null, onClose }) {
  return (
    // Android geri tuşu: cevap verilmiş olabilir, çağıran taraf yenilesin.
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => onClose({ changed: true })}>
      {visible ? <SheetBody token={token} editQuestion={editQuestion} onClose={onClose} /> : null}
    </Modal>
  );
}

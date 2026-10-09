import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { KIVIRIK_QUESTIONS } from "../config/kivirikQuestions";
import { fontFamily, useTheme } from "../theme";
import { MONTH_NAMES, isYearly, periodLabel } from "../utils/billing";
import { formatSubscriptionPrice } from "../utils/price";
import { BillingDayPicker } from "./BillingDayPicker";
import { KivirikHead } from "./brand";
import { ServiceLogo } from "./ServiceLogo";

const BUBBLE_TEXT = "#F5F3F7";
const BUBBLE_NOTE = "#CFCBD6";
const SAFRAN = "#FFC53D";

// Bu sorularda Kıvırık düşünceli bakar (fiyat, süre gibi kontrol soruları).
const THINKING_KEYS = new Set(["price_confirm", "planned_end", "monthly_budget", "is_trial"]);

function pad(n) {
  return String(n).padStart(2, "0");
}

// Seçilen ay/gün için bugünden sonraki ilk tarih ('YYYY-MM-DD'). Şubat 29
// artık yıl değilse 28'e iner.
export function nextDateIso({ day, month }, from = new Date()) {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (const year of [today.getFullYear(), today.getFullYear() + 1]) {
    const last = new Date(year, month, 0).getDate();
    const date = new Date(year, month - 1, Math.min(day, last));
    if (date >= today) {
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }
  }
  return null;
}

export function formatIsoDate(iso) {
  if (!iso) return null;
  const [year, month, day] = iso.split("-").map(Number);
  return `${day} ${MONTH_NAMES[month - 1]} ${year}`;
}

export function ProgressDots({ index, count }) {
  const { colors } = useTheme();
  if (count <= 1) return null;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Soru ${index + 1} / ${count}`}
      style={{ flexDirection: "row", gap: 5 }}
    >
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={{
            width: i === index ? 18 : 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: i <= index ? colors.text : colors.divider,
          }}
        />
      ))}
    </View>
  );
}

// Kartın üstündeki servis şeridi: logo, ad + plan, fiyat; sağda ilerleme.
function ServiceStrip({ params, index, count }) {
  const { colors, spacing } = useTheme();
  const price = formatSubscriptionPrice(params);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm + 4,
        backgroundColor: colors.bg,
        borderRadius: 18,
        paddingVertical: 10,
        paddingHorizontal: 12,
      }}
    >
      <ServiceLogo
        domain={params.domain}
        logoUrl={params.logo_url}
        name={params.app_name}
        category={params.category}
        size={40}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }} numberOfLines={1}>
          {params.app_name}
          {params.plan_name ? ` ${params.plan_name}` : ""}
        </Text>
        <Text style={{ fontSize: 13, color: colors.text2 }} numberOfLines={1}>
          {price.primary} {periodLabel(params)}
        </Text>
      </View>
      <ProgressDots index={index} count={count} />
    </View>
  );
}

function OptionButton({ label, hint, onPress, disabled }) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => ({
        minHeight: 52,
        paddingVertical: 12,
        paddingHorizontal: 18,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: colors.divider,
        backgroundColor: colors.card,
        justifyContent: "center",
        gap: 2,
        opacity: pressed || disabled ? 0.6 : 1,
      })}
    >
      <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text }}>{label}</Text>
      {hint ? (
        <Text style={{ fontSize: 13, fontWeight: "500", color: colors.text2 }}>{hint}</Text>
      ) : null}
    </Pressable>
  );
}

function SaveButton({ onPress, disabled, busy }) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      style={({ pressed }) => ({
        width: 110,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.4 : pressed || busy ? 0.7 : 1,
      })}
    >
      <Text style={{ fontFamily: fontFamily.extraBold, fontSize: 16, color: colors.onPrimary }}>
        Kaydet
      </Text>
    </Pressable>
  );
}

// Tutar/metin girişi: 56px alan + Kaydet.
function TextEntry({ kind, label, note, onSubmit, busy }) {
  const { colors } = useTheme();
  const [text, setText] = useState("");
  // "1.249,99" ve "249,99" Türkçe biçim; yalnızca nokta varsa ondalık sayılır.
  const amount = Number(text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text);
  const valid = kind === "amount" ? Number.isFinite(amount) && amount > 0 : text.trim().length > 0;

  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text2 }}>{label}</Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View
          style={{
            flex: 1,
            height: 56,
            borderRadius: 18,
            borderWidth: 2,
            borderColor: colors.text,
            backgroundColor: colors.bg,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            gap: 6,
          }}
        >
          <TextInput
            value={text}
            onChangeText={(next) =>
              setText(kind === "amount" ? next.replace(/[^0-9.,]/g, "").slice(0, 12) : next.slice(0, 200))
            }
            keyboardType={kind === "amount" ? "decimal-pad" : "default"}
            autoFocus
            accessibilityLabel={label}
            placeholder={kind === "amount" ? "0,00" : "Yaz..."}
            placeholderTextColor={colors.text2}
            style={{
              flex: 1,
              minWidth: 0,
              color: colors.text,
              fontFamily: kind === "amount" ? fontFamily.extraBold : undefined,
              fontSize: kind === "amount" ? 22 : 16,
            }}
          />
          {kind === "amount" ? (
            <Text style={{ fontFamily: fontFamily.bold, fontSize: 20, color: colors.text2 }}>₺</Text>
          ) : null}
        </View>
        <SaveButton
          disabled={!valid}
          busy={busy}
          onPress={() => onSubmit(kind === "amount" ? Math.round(amount * 100) / 100 : text.trim())}
        />
      </View>
      {note ? <Text style={{ fontSize: 13, lineHeight: 18, color: colors.text2 }}>{note}</Text> : null}
    </View>
  );
}

// Gün + ay seçici; bugünden sonraki ilk tarihi gönderir.
function DateEntry({ label, onSubmit, busy }) {
  const { colors } = useTheme();
  const [value, setValue] = useState({ day: null, month: null });
  const iso = value.day && value.month ? nextDateIso(value) : null;

  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text2 }}>{label}</Text>
      <BillingDayPicker yearly day={value.day} month={value.month} onChange={setValue} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text style={{ flex: 1, fontSize: 15, fontWeight: "700", color: colors.text }}>
          {iso ? formatIsoDate(iso) : "Ay ve gün seç"}
        </Text>
        <SaveButton disabled={!iso} busy={busy} onPress={() => onSubmit(iso)} />
      </View>
    </View>
  );
}

// Ödeme günü sorusu: ortak gün seçici + Kaydet; seçenekler (Bilmiyorum) altta.
function BillingEntry({ params, onSubmit, busy }) {
  const [value, setValue] = useState({ day: null, month: null });
  const yearly = isYearly(params);
  const valid = Boolean(value.day) && (!yearly || Boolean(value.month));

  return (
    <View style={{ gap: 10 }}>
      <BillingDayPicker yearly={yearly} day={value.day} month={value.month} onChange={setValue} />
      <View style={{ alignItems: "flex-end" }}>
        <SaveButton
          disabled={!valid}
          busy={busy}
          onPress={() =>
            onSubmit({ billing_date: value.day, billing_month: yearly ? value.month : null })
          }
        />
      </View>
    </View>
  );
}

// Tek bir Kıvırık sorusu (K2 kartı). onAnswer({ answer, value }),
// onSkip ("Geç"), onNever ("Bunu bir daha sorma"). Kullanıcı başına
// sorularda şerit yerine yalnızca ilerleme noktaları görünür.
// initialInput: ilgili seçeneğin giriş alanıyla açılır (ör. detaydan
// "Değiştir"). hideFooter: detaydan tek alan düzenlerken.
export function KivirikQuestionCard({
  question,
  index = 0,
  count = 1,
  busy = false,
  onAnswer,
  onSkip,
  onNever,
  initialInput = null,
  hideFooter = false,
}) {
  const { colors, isDark, spacing } = useTheme();
  const config = KIVIRIK_QUESTIONS[question.key];
  const params = question.params ?? {};
  const isSubscription = Boolean(question.user_subscription_id);
  const options = config.options(params);
  const [inputOption, setInputOption] = useState(
    initialInput ? options.find((option) => option.input === initialInput) ?? null : null
  );
  const note = config.note?.(params);

  function pick(option) {
    if (option.input) {
      setInputOption(option);
      return;
    }
    onAnswer({ answer: option.answer, value: option.value });
  }

  function submitInput(value) {
    onAnswer({ answer: inputOption.answer, value });
  }

  return (
    <View style={{ flex: 1, gap: 18 }}>
      {isSubscription ? (
        <ServiceStrip params={params} index={index} count={count} />
      ) : count > 1 ? (
        <View style={{ alignItems: "flex-end" }}>
          <ProgressDots index={index} count={count} />
        </View>
      ) : null}

      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
        <KivirikHead size={64} mood={THINKING_KEYS.has(question.key) ? "dusunceli" : "normal"} />
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
          <Text style={{ fontSize: 12, fontWeight: "700", color: SAFRAN }}>Kıvırık</Text>
          <Text
            accessibilityRole="header"
            style={{
              marginTop: 2,
              fontFamily: fontFamily.extraBold,
              fontSize: 19,
              lineHeight: 23,
              letterSpacing: -0.3,
              color: BUBBLE_TEXT,
            }}
          >
            {config.text(params)}
          </Text>
          {note ? (
            <Text style={{ marginTop: 6, fontSize: 13, lineHeight: 18, color: BUBBLE_NOTE }}>{note}</Text>
          ) : null}
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: 8, paddingBottom: spacing.sm }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {inputOption ? (
          inputOption.input === "date" ? (
            <DateEntry label={config.inputLabel?.(params)} onSubmit={submitInput} busy={busy} />
          ) : (
            <TextEntry
              kind={inputOption.input}
              label={config.inputLabel?.(params)}
              note={config.inputNote?.(params)}
              onSubmit={submitInput}
              busy={busy}
            />
          )
        ) : (
          <>
            {config.picker === "billing" ? (
              <BillingEntry
                params={params}
                busy={busy}
                onSubmit={(value) => onAnswer({ answer: "set", value })}
              />
            ) : null}
            {options.map((option) => (
              <OptionButton
                key={`${option.answer}-${option.label}`}
                label={option.label}
                hint={option.hint}
                disabled={busy}
                onPress={() => pick(option)}
              />
            ))}
          </>
        )}
      </ScrollView>

      {!hideFooter ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <Pressable
            onPress={onSkip}
            disabled={busy}
            accessibilityRole="button"
            style={({ pressed }) => ({
              height: 48,
              paddingHorizontal: 18,
              borderRadius: 24,
              borderWidth: 2,
              borderColor: colors.divider,
              justifyContent: "center",
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>Geç</Text>
          </Pressable>
          <Pressable
            onPress={onNever}
            disabled={busy}
            accessibilityRole="button"
            style={({ pressed }) => ({
              height: 48,
              paddingHorizontal: 6,
              justifyContent: "center",
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text
              style={{ fontSize: 14, fontWeight: "600", color: colors.text2, textDecorationLine: "underline" }}
            >
              Bunu bir daha sorma
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

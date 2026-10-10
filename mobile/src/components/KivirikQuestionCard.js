import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { KIVIRIK_QUESTIONS } from "../config/kivirikQuestions";
import { fontFamily, useTheme } from "../theme";
import { MONTH_NAMES, isYearly, periodLabel } from "../utils/billing";
import { formatAmount, formatSubscriptionPrice } from "../utils/price";
import { BillingDayPicker } from "./BillingDayPicker";
import { KivirikHead } from "./brand";
import { ServiceLogo } from "./ServiceLogo";

const BUBBLE_TEXT = "#F5F3F7";
const BUBBLE_NOTE = "#CFCBD6";
const SAFRAN = "#FFC53D";

// Bu sorularda Kıvırık düşünceli bakar (fiyat, süre gibi kontrol soruları).
// Yeni sorular yüzü config'teki mood ile seçer.
const THINKING_KEYS = new Set(["price_confirm", "planned_end", "monthly_budget", "is_trial"]);

function ArrowUpIcon({ color, size = 12 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 12 12">
      <Path
        d="M6 10.5V1.8M2.2 5.4 6 1.6l3.8 3.8"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function ClockIcon({ color, size = 12 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 12 12">
      <Circle cx={6} cy={6} r={4.9} stroke={color} strokeWidth={1.6} fill="none" />
      <Path d="M6 3.3V6l1.9 1.2" stroke={color} strokeWidth={1.6} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

// Tetiklemeli kartların üst etiketi: K3 zam (kırmızı tonlu, ok) ve K4
// deneme bitiyor (safran tonlu, saat). Sağda zaman bilgisi.
function QuestionBadge({ tone, label, detail }) {
  const { colors, isDark, brand } = useTheme();
  const isPrice = tone === "price";
  const background = isPrice ? "rgba(200,49,42,0.14)" : "rgba(255,197,61,0.26)";
  const foreground = isPrice ? colors.danger : isDark ? brand.safran : "#7A4E00";
  const Icon = isPrice ? ArrowUpIcon : ClockIcon;

  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 5,
          backgroundColor: background,
          borderRadius: 999,
          paddingHorizontal: 10,
          paddingVertical: 5,
        }}
      >
        <Icon color={foreground} />
        <Text style={{ fontSize: 12.5, fontWeight: "800", color: foreground }}>{label}</Text>
      </View>
      {detail ? (
        <Text style={{ fontSize: 13, fontWeight: isPrice ? "600" : "800", color: isPrice ? colors.text2 : colors.text }}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

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
// Zamda eski fiyat üstü çizili, yeni fiyat kırmızı.
function ServiceStrip({ params, index, count }) {
  const { colors, spacing } = useTheme();
  const price = formatSubscriptionPrice(params);
  const isPriceChange = params.old_price != null && params.new_price != null;

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
        {isPriceChange ? (
          <Text style={{ fontSize: 13, color: colors.text2 }} numberOfLines={1}>
            <Text style={{ textDecorationLine: "line-through" }}>
              {formatAmount(params.old_price, params.price_currency)}
            </Text>{" "}
            <Text style={{ fontWeight: "800", color: colors.danger }}>
              {formatAmount(params.new_price, params.price_currency)}
            </Text>{" "}
            {periodLabel(params)}
          </Text>
        ) : (
          <Text style={{ fontSize: 13, color: colors.text2 }} numberOfLines={1}>
            {price.primary} {periodLabel(params)}
          </Text>
        )}
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
// onSkip ("Geç"), onNever ("Bunu bir daha sorma"), onDismiss(mode)
// (dismiss'li seçenekler, ör. "Yarın tekrar hatırlat"). Kullanıcı başına
// sorularda şerit yerine yalnızca ilerleme noktaları görünür.
// initialInput: ilgili seçeneğin giriş alanıyla açılır (ör. detaydan
// "Değiştir"). hideFooter: detaydan tek alan düzenlerken.
// override: aynı kartta takip sorusu ({ text, note, options }); etiket ve
// alt bilgi gizlenir.
export function KivirikQuestionCard({
  question,
  index = 0,
  count = 1,
  busy = false,
  onAnswer,
  onSkip,
  onNever,
  onDismiss,
  initialInput = null,
  hideFooter = false,
  override = null,
}) {
  const { colors, isDark, spacing } = useTheme();
  const baseConfig = KIVIRIK_QUESTIONS[question.key];
  const config = override ?? baseConfig;
  const params = question.params ?? {};
  const isSubscription = Boolean(question.user_subscription_id);
  const options = config.options(params);
  const [inputOption, setInputOption] = useState(
    initialInput ? options.find((option) => option.input === initialInput) ?? null : null
  );
  const note = config.note?.(params);
  const badge = override ? null : baseConfig.badge?.(params);
  const mood = baseConfig.mood ?? (THINKING_KEYS.has(question.key) ? "dusunceli" : "normal");

  function pick(option) {
    if (option.input) {
      setInputOption(option);
      return;
    }
    if (option.dismiss) {
      onDismiss?.(option.dismiss);
      return;
    }
    onAnswer({ answer: option.answer, value: option.value });
  }

  function submitInput(value) {
    onAnswer({ answer: inputOption.answer, value });
  }

  return (
    <View style={{ flex: 1, gap: 18 }}>
      {badge ? <QuestionBadge {...badge} /> : null}
      {isSubscription ? (
        <ServiceStrip params={params} index={index} count={count} />
      ) : count > 1 ? (
        <View style={{ alignItems: "flex-end" }}>
          <ProgressDots index={index} count={count} />
        </View>
      ) : null}

      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
        <KivirikHead size={64} mood={override ? "dusunceli" : mood} />
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

      {!hideFooter && !override ? (
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

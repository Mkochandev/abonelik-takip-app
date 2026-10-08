import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Kivirik, NoodleBackground, PillButton } from "../components";
import { APP_NAME } from "../config/brand";
import { useAuth } from "../context/AuthContext";
import { brandColors, fontFamily, useNightStatusBar, useTheme } from "../theme";

const COPY = {
  login: {
    title: "Tekrar hoş geldin",
    subtitle: "Kıvırık aboneliklerini bekletiyordu.",
    submit: "Giriş yap",
    mood: "selam",
  },
  register: {
    title: "Kâseni kuralım",
    subtitle: "Listen yedeklensin, telefon değişse de kaybolmasın.",
    submit: "Hesap oluştur",
    mood: "mutlu",
  },
};

const MASCOT_WIDTH = 220;
// Kâsenin altı viewBox'ta 222/230'da biter; kalan şeffaf pay kadar form
// kartının üstüne bindirilir ki kâse kartın kenarına otursun.
const MASCOT_OVERLAP = Math.round((MASCOT_WIDTH * (230 - 222)) / 240);

// Giriş/kayıt sonrası Paywall açılmalı mı? result, AuthContext.login/register
// dönüşüdür ({ plan, guestSync }); next, ekrana verilen route parametresi.
export function shouldOpenPaywall(result, next) {
  if (!result || result.plan === "premium") {
    return false;
  }
  return Boolean(result.guestSync?.limit_reached) || next === "Paywall";
}

function Field({ label, ...inputProps }) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        height: 56,
        borderRadius: 18,
        backgroundColor: colors.field,
        paddingHorizontal: 16,
        justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "600", color: colors.text2 }}>{label}</Text>
      <TextInput
        style={{ fontSize: 16, color: colors.text, paddingVertical: 0, marginTop: 2 }}
        placeholderTextColor={colors.text2}
        {...inputProps}
      />
    </View>
  );
}

function ModeSegment({ mode, onChange }) {
  const { colors, isDark } = useTheme();

  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: "row",
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.field,
        padding: 4,
      }}
    >
      {[
        ["login", "Giriş yap"],
        ["register", "Kayıt ol"],
      ].map(([value, label]) => {
        const active = mode === value;
        return (
          <Pressable
            key={value}
            onPress={() => onChange(value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={{
              flex: 1,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: active ? (isDark ? "#3A3642" : "#FFFFFF") : "transparent",
              ...(active
                ? {
                    shadowColor: "#000000",
                    shadowOpacity: 0.1,
                    shadowRadius: 6,
                    shadowOffset: { width: 0, height: 2 },
                    elevation: 2,
                  }
                : null),
            }}
          >
            <Text
              style={{
                fontFamily: fontFamily.bold,
                fontSize: 15,
                color: active ? colors.text : colors.text2,
              }}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Giriş ve kayıt tek ekranda iki mod olarak; Login/Register rotaları yalnızca
// başlangıç modunu belirler. Koyu zemin iki temada da aynıdır, form kartı
// temaya uyar.
export default function AuthScreen({ navigation, route, initialMode }) {
  const { login, register } = useAuth();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const promptMessage = route.params?.promptMessage;
  const next = route.params?.next;
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const copy = COPY[mode];

  useNightStatusBar();

  function handleModeChange(value) {
    setMode(value);
    setError(null);
  }

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      const action = mode === "login" ? login : register;
      const result = await action(email.trim(), password);
      // Misafir listesi aktarılırken limite takıldıysa ya da kullanıcı buraya
      // misafir limiti ekranından geldiyse Paywall'a geç (premium değilse).
      if (shouldOpenPaywall(result, next)) {
        navigation.replace("Paywall");
      } else {
        navigation.goBack();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: brandColors.ink }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={{ flex: 1, overflow: "hidden" }}>
        <NoodleBackground height={420} opacity={0.18} />
        <Text
          style={{
            marginTop: Math.max(64, insets.top + spacing.md),
            textAlign: "center",
            fontFamily: fontFamily.extraBold,
            fontSize: 22,
            color: brandColors.safran,
          }}
        >
          {APP_NAME}
        </Text>
        <View
          style={{
            position: "absolute",
            bottom: -MASCOT_OVERLAP,
            left: 0,
            right: 0,
            alignItems: "center",
          }}
        >
          <Kivirik size={MASCOT_WIDTH} mood={copy.mood} bowl="krem" />
        </View>
      </View>

      <View
        style={{
          backgroundColor: colors.card,
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
          paddingTop: 28,
          paddingHorizontal: 24,
          paddingBottom: Math.max(34, insets.bottom + spacing.md),
          gap: 14,
        }}
      >
        <View>
          <Text style={{ fontFamily: fontFamily.extraBold, fontSize: 30, color: colors.text }}>
            {copy.title}
          </Text>
          <Text style={{ fontSize: 15, color: colors.text2, marginTop: 4, lineHeight: 21 }}>
            {promptMessage || copy.subtitle}
          </Text>
        </View>

        <ModeSegment mode={mode} onChange={handleModeChange} />

        <Field
          label="E-posta"
          placeholder="ornek@eposta.com"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Field
          label="Şifre"
          placeholder="••••••••"
          secureTextEntry
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          value={password}
          onChangeText={setPassword}
        />

        {mode === "login" ? (
          // Şifre sıfırlama akışı henüz yok; bağlantı pasif duruyor.
          <Text
            accessibilityRole="link"
            accessibilityState={{ disabled: true }}
            style={{ alignSelf: "flex-end", color: colors.text2, fontSize: 13.5, fontWeight: "600", opacity: 0.5 }}
          >
            Şifremi unuttum
          </Text>
        ) : null}

        {error ? <Text style={{ color: colors.danger, textAlign: "center" }}>{error}</Text> : null}

        <PillButton title={copy.submit} height={58} onPress={handleSubmit} loading={loading} />

        <Text
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          style={{ color: colors.text, fontWeight: "600", fontSize: 15, textAlign: "center" }}
        >
          Misafir olarak devam et
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

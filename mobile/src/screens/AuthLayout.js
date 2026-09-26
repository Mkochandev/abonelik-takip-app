import { KeyboardAvoidingView, Platform, Text, TextInput, View } from "react-native";

import { BrandIcon } from "../components/BrandIcon";
import { PillButton } from "../components/PillButton";
import { APP_NAME, SLOGAN } from "../config/brand";
import { fontFamily, useTheme } from "../theme";

// Login ve Register ekranları aynı görünümü paylaşır; yalnızca başlık,
// buton metni ve alt link farklıdır.
export function AuthLayout({
  title,
  linkPrefix,
  linkLabel,
  onLinkPress,
  email,
  onChangeEmail,
  password,
  onChangePassword,
  error,
  loading,
  onSubmit,
}) {
  const { colors, spacing, radius } = useTheme();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          paddingHorizontal: spacing.lg,
        }}
      >
        <View style={{ alignItems: "center", marginBottom: spacing.xl }}>
          <BrandIcon size={88} />
          <Text
            style={{
              fontFamily: fontFamily.extraBold,
              fontSize: 48,
              letterSpacing: -2,
              color: colors.text,
              marginTop: spacing.md,
            }}
          >
            {APP_NAME}
          </Text>
          <Text style={{ color: colors.text2, marginTop: spacing.xs }}>
            {SLOGAN}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: radius.card,
            padding: spacing.md,
          }}
        >
          <View style={{ paddingBottom: spacing.sm }}>
            <Text
              style={{ fontSize: 13, fontWeight: "600", color: colors.text2 }}
            >
              E-posta
            </Text>
            <TextInput
              style={{ fontSize: 16, color: colors.text, paddingVertical: 8 }}
              placeholder="ornek@eposta.com"
              placeholderTextColor={colors.text2}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={onChangeEmail}
            />
          </View>

          <View style={{ height: 1, backgroundColor: colors.divider }} />

          <View style={{ paddingTop: spacing.sm }}>
            <Text
              style={{ fontSize: 13, fontWeight: "600", color: colors.text2 }}
            >
              Şifre
            </Text>
            <TextInput
              style={{ fontSize: 16, color: colors.text, paddingVertical: 8 }}
              placeholder="••••••••"
              placeholderTextColor={colors.text2}
              secureTextEntry
              value={password}
              onChangeText={onChangePassword}
            />
          </View>
        </View>

        {error ? (
          <Text
            style={{
              color: colors.danger,
              textAlign: "center",
              marginTop: spacing.md,
            }}
          >
            {error}
          </Text>
        ) : null}

        <View style={{ marginTop: spacing.lg }}>
          <PillButton title={title} onPress={onSubmit} loading={loading} />
        </View>

        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            marginTop: spacing.lg,
          }}
        >
          <Text style={{ color: colors.text2 }}>{linkPrefix} </Text>
          <Text
            onPress={onLinkPress}
            style={{
              color: colors.text,
              fontWeight: "700",
              textDecorationLine: "underline",
            }}
          >
            {linkLabel}
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

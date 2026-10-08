import { ActivityIndicator, Pressable, Text } from "react-native";

import { useTheme } from "../theme";

const DEFAULT_HEIGHT = 56;

export function PillButton({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  height = DEFAULT_HEIGHT,
  style,
}) {
  const { colors, brand, typography, pillRadius } = useTheme();
  const radius = pillRadius(height);

  const variants = {
    primary: {
      backgroundColor: colors.primary,
      borderWidth: 0,
      textColor: colors.onPrimary,
    },
    // Safran vurgu butonu: koyu zeminli ekranlar ve akış sonu (Kaydet) için.
    accent: {
      backgroundColor: brand.safran,
      borderWidth: 0,
      textColor: brand.ink,
    },
    outline: {
      backgroundColor: "transparent",
      borderWidth: 1.5,
      borderColor: colors.text,
      textColor: colors.text,
    },
    danger: {
      backgroundColor: "transparent",
      borderWidth: 1.5,
      borderColor: brand.biber,
      textColor: colors.danger,
    },
  };

  const v = variants[variant] ?? variants.primary;
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        {
          height,
          borderRadius: radius,
          backgroundColor: v.backgroundColor,
          borderWidth: v.borderWidth,
          borderColor: v.borderColor,
          alignItems: "center",
          justifyContent: "center",
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.textColor} />
      ) : (
        <Text style={[typography.button, { color: v.textColor }]}>{title}</Text>
      )}
    </Pressable>
  );
}

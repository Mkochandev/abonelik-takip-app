import { ActivityIndicator, Pressable, Text } from "react-native";

import { useTheme } from "../theme";

const HEIGHT = 56;

export function PillButton({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  style,
}) {
  const { colors, typography, pillRadius } = useTheme();
  const radius = pillRadius(HEIGHT);

  const variants = {
    primary: {
      backgroundColor: colors.primary,
      borderWidth: 0,
      textColor: colors.onPrimary,
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
      borderColor: colors.danger,
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
          height: HEIGHT,
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

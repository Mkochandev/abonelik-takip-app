import { Pressable, Text } from "react-native";

import { useTheme } from "../theme";

const HEIGHT = 44;

export function Chip({ label, children, selected = false, onPress, style }) {
  const { colors, pillRadius } = useTheme();
  const radius = pillRadius(HEIGHT);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        {
          height: HEIGHT,
          borderRadius: radius,
          paddingHorizontal: 18,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: selected ? colors.primary : "transparent",
          borderWidth: selected ? 0 : 1.5,
          borderColor: colors.text,
          opacity: pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      <Text
        style={{
          fontSize: 14.5,
          fontWeight: "600",
          color: selected ? colors.onPrimary : colors.text,
        }}
      >
        {label ?? children}
      </Text>
    </Pressable>
  );
}

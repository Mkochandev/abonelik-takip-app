import { View } from "react-native";

import { useTheme } from "../theme";

export function Card({ children, style, noPadding = false }) {
  const { colors, radius, spacing } = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: radius.card,
          padding: noPadding ? 0 : spacing.md,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

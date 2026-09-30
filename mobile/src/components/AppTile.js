import { Text, View } from "react-native";

import { fontFamily, useTheme } from "../theme";

// Pastel zemin üstünde baş harf. Logosu olmayan ya da logosu yüklenemeyen
// servisler için ServiceLogo bu karoya düşer.
export function AppTile({ name = "", color, size = 44, style }) {
  const { colors, radius, brand } = useTheme();
  const letter = name.trim().charAt(0).toUpperCase() || "?";
  const backgroundColor = color ?? colors.field;

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius.tile,
          backgroundColor,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        },
        style,
      ]}
    >
      <Text
        style={{
          fontFamily: fontFamily.bold,
          fontSize: size * 0.4,
          color: brand.ink,
        }}
      >
        {letter}
      </Text>
    </View>
  );
}

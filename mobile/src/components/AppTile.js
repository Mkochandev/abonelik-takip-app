import { Image, Text, View } from "react-native";

import { fontFamily, useTheme } from "../theme";

// Servis logosu gelene kadar yer tutucu: pastel zemin üstünde baş harf.
// logoUrl verilirse aynı karonun içinde logo gösterilir.
export function AppTile({ name = "", color, logoUrl, size = 44, style }) {
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
      {logoUrl ? (
        <Image
          source={{ uri: logoUrl }}
          style={{ width: size, height: size }}
          resizeMode="cover"
        />
      ) : (
        <Text
          style={{
            fontFamily: fontFamily.bold,
            fontSize: size * 0.4,
            color: brand.ink,
          }}
        >
          {letter}
        </Text>
      )}
    </View>
  );
}

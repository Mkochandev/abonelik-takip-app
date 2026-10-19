import { Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { getCategoryColor, useTheme } from "../theme";
import { getCategoryIconPaths } from "./icons/categoryPaths";

// Kategori pastelinde küçük etiket: mini ikon + isim (detay ekranındaki
// kategori rozeti gibi kompakt yerlerde kullanılır).
export function CategoryTag({ category, style }) {
  const { brand, pillRadius } = useTheme();
  const backgroundColor = getCategoryColor(category);
  const paths = getCategoryIconPaths(category);

  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          alignSelf: "flex-start",
          gap: 6,
          backgroundColor,
          borderRadius: pillRadius(28),
          paddingVertical: 6,
          paddingHorizontal: 12,
        },
        style,
      ]}
    >
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
        {paths.map((d) => (
          <Path
            key={d}
            d={d}
            stroke={brand.ink}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </Svg>
      <Text style={{ fontSize: 12, fontWeight: "600", color: brand.ink }}>
        {category}
      </Text>
    </View>
  );
}

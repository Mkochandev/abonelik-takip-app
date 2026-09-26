import { Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { useTheme } from "../theme";
import { categoryIconPaths } from "./icons/categoryPaths";

// Kategori pastelinde küçük etiket: mini ikon + isim (detay ekranındaki
// kategori rozeti gibi kompakt yerlerde kullanılır).
export function CategoryTag({ category, style }) {
  const { categories, brand, pillRadius } = useTheme();
  const backgroundColor = categories[category] ?? categories["Video/Dizi-Film"];
  const paths = categoryIconPaths[category] ?? [];

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

import { View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { useTheme } from "../theme";
import { categoryIconPaths } from "./icons/categoryPaths";

const SIZE = 48;
const ICON_SIZE = 24;

export function CategoryBadge({ category, size = SIZE, style }) {
  const { categories, brand } = useTheme();
  const backgroundColor = categories[category] ?? categories["Video/Dizi-Film"];
  const paths = categoryIconPaths[category] ?? [];
  const iconSize = (ICON_SIZE / SIZE) * size;

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
        {paths.map((d) => (
          <Path
            key={d}
            d={d}
            stroke={brand.ink}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </Svg>
    </View>
  );
}

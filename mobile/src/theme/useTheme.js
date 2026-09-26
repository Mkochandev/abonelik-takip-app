import { useColorScheme } from "react-native";

import { brandColors, categoryColors, darkColors, lightColors } from "./colors";
import { pillRadius, radius, spacing } from "./metrics";
import { typography } from "./typography";

export function useTheme() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  return {
    isDark,
    colors: isDark ? darkColors : lightColors,
    brand: brandColors,
    categories: categoryColors,
    spacing,
    radius,
    pillRadius,
    typography,
  };
}

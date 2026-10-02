import { TextInput, View } from "react-native";
import Svg, { Circle, Line } from "react-native-svg";

import { useTheme } from "../theme";

const HEIGHT = 52;

function SearchIcon({ color }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={10} cy={10} r={7} stroke={color} strokeWidth={1.8} />
      <Line x1={15} y1={15} x2={21} y2={21} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

// Hap şeklinde arama kutusu (Katalog ve onboarding servis seçimi).
export function SearchField({ value, onChangeText, placeholder = "Uygulama ara...", style }) {
  const { colors, spacing, pillRadius } = useTheme();

  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          height: HEIGHT,
          backgroundColor: colors.card,
          borderRadius: pillRadius(HEIGHT),
          paddingHorizontal: spacing.md,
          gap: spacing.sm,
        },
        style,
      ]}
    >
      <SearchIcon color={colors.text2} />
      <TextInput
        style={{ flex: 1, fontSize: 16, color: colors.text }}
        placeholder={placeholder}
        placeholderTextColor={colors.text2}
        autoCapitalize="none"
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}

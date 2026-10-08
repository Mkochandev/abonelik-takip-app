import { Text, View } from "react-native";

import { useTheme } from "../../theme";

// Kıvırık'ın konuşma balonu. Kuyruk tarafındaki köşe daha keskin (6) kalır:
// tail="left" sol alt, tail="right" sağ üst. children verilirse text yerine
// o gösterilir (örn. ekleme akışındaki büyük soru metni).
export function KivirikBubble({ text, title = "Kıvırık", tail = "left", children, style }) {
  const { isDark } = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: isDark ? "#26232D" : "#15131A",
          borderRadius: 20,
          borderBottomLeftRadius: tail === "left" ? 6 : 20,
          borderTopRightRadius: tail === "right" ? 6 : 20,
          paddingVertical: 14,
          paddingHorizontal: 16,
        },
        style,
      ]}
    >
      {title ? (
        <Text style={{ color: "#FFC53D", fontSize: 12, fontWeight: "700", marginBottom: 4 }}>
          {title}
        </Text>
      ) : null}
      {children ?? (
        <Text style={{ color: "#F5F3F7", fontSize: 15, fontWeight: "600", lineHeight: 21 }}>
          {text}
        </Text>
      )}
    </View>
  );
}

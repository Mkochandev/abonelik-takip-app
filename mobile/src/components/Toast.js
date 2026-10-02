import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Text } from "react-native";

import { useTheme } from "../theme";

const VISIBLE_MS = 2200;

// Ekranın altında kısa süre görünen onay mesajı. Öğe ekranın kök
// View'ına (position: absolute ile) eklenir. Kullanım:
//   const [toast, showToast] = useToast();
//   showToast("Eklendi");  ...  return <View>{...}{toast}</View>;
export function useToast({ bottomOffset = 24 } = {}) {
  const { brand, pillRadius } = useTheme();
  const [message, setMessage] = useState(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef(null);

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  const show = useCallback(
    (text) => {
      clearTimeout(hideTimer.current);
      setMessage(text);
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
      hideTimer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(
          ({ finished }) => finished && setMessage(null)
        );
      }, VISIBLE_MS);
    },
    [opacity]
  );

  const element = message ? (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        bottom: bottomOffset,
        alignItems: "center",
        opacity,
      }}
    >
      <Text
        style={{
          backgroundColor: brand.ink,
          color: "#FFFFFF",
          fontWeight: "600",
          fontSize: 14.5,
          paddingHorizontal: 18,
          paddingVertical: 12,
          borderRadius: pillRadius(44),
          overflow: "hidden",
        }}
      >
        {message}
      </Text>
    </Animated.View>
  ) : null;

  return [element, show];
}

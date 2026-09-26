import { useEffect, useRef } from "react";
import { Animated, Pressable } from "react-native";

import { useTheme } from "../theme";

const WIDTH = 54;
const HEIGHT = 32;
const THUMB = 26;
const PADDING = (HEIGHT - THUMB) / 2;

export function Toggle({ value = false, onValueChange, disabled = false }) {
  const { colors } = useTheme();
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 150,
      useNativeDriver: false,
    }).start();
  }, [value, anim]);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [PADDING, WIDTH - THUMB - PADDING],
  });

  return (
    <Pressable
      onPress={() => !disabled && onValueChange?.(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      style={{
        width: WIDTH,
        height: HEIGHT,
        borderRadius: HEIGHT / 2,
        backgroundColor: value ? colors.primary : colors.switchOff,
        justifyContent: "center",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Animated.View
        style={{
          width: THUMB,
          height: THUMB,
          borderRadius: THUMB / 2,
          backgroundColor: "#FFFFFF",
          transform: [{ translateX }],
        }}
      />
    </Pressable>
  );
}

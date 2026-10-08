import { useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { setStatusBarStyle } from "expo-status-bar";

import { useTheme } from "./useTheme";

// Her zaman koyu zeminli ekranlar odaktayken durum çubuğu açık renkli olur;
// ekrandan çıkınca sistem temasına döner. Stack'te altta kalan ekranlar
// mount'lu kaldığı için <StatusBar> yerine odak olaylarıyla yönetilir.
export function useNightStatusBar() {
  const { isDark } = useTheme();

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("light");
      return () => setStatusBarStyle(isDark ? "light" : "dark");
    }, [isDark])
  );
}

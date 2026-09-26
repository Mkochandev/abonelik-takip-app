import { APP_NAME } from "./src/config/brand";

export default {
  expo: {
    name: APP_NAME,
    slug: "abonelik-takip",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    primaryColor: "#4F46E5",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#4F46E5",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.mkochandev.aboneliktakip",
    },
    android: {
      package: "com.mkochandev.aboneliktakip",
      adaptiveIcon: {
        backgroundColor: "#4F46E5",
        foregroundImage: "./assets/android-icon-foreground.png",
        backgroundImage: "./assets/android-icon-background.png",
        monochromeImage: "./assets/android-icon-monochrome.png",
      },
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    plugins: ["expo-font", "expo-splash-screen"],
  },
};

import { APP_NAME } from "./src/config/brand";

export default {
  expo: {
    name: APP_NAME,
    slug: "abonelik-takip",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    primaryColor: "#FFC53D",
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.mkochandev.aboneliktakip",
    },
    android: {
      package: "com.mkochandev.aboneliktakip",
      adaptiveIcon: {
        backgroundColor: "#15131A",
        foregroundImage: "./assets/android-icon-foreground.png",
        monochromeImage: "./assets/android-icon-monochrome.png",
      },
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    plugins: [
      "expo-font",
      [
        "expo-splash-screen",
        {
          image: "./assets/splash-icon.png",
          imageWidth: 220,
          resizeMode: "contain",
          backgroundColor: "#15131A",
        },
      ],
    ],
  },
};

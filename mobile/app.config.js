import { APP_NAME } from "./src/config/brand";

export default {
  expo: {
    name: APP_NAME,
    slug: "abonelik-takip",
        owner: "mkochan",
    extra: {
      eas: {
        projectId: "63f13b8f-5a46-4209-9741-4726e3cc1bab",
      },
    },
    scheme: "aboneliktakip",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    primaryColor: "#FFC53D",
    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.mkochandev.aboneliktakip",
      config: {
        usesNonExemptEncryption: false,
      },
    },
    android: {
      package: "com.mkochandev.aboneliktakip",
      adaptiveIcon: {
        backgroundColor: "#15131A",
        foregroundImage: "./assets/adaptive-icon.png",
      },
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    plugins: [
      "expo-font",
      "expo-image",
      [
        "expo-notifications",
        {
          // Yalnızca yerel (cihazda planlanan) ödeme hatırlatmaları.
          color: "#FFC53D",
        },
      ],
      "expo-secure-store",
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

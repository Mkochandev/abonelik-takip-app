import { useState } from "react";
import { View } from "react-native";
import { Image } from "expo-image";

import { useTheme } from "../theme";
import { AppTile } from "./AppTile";

// Anahtar yoksa alan adından logo üretilemez; yalnızca logoUrl'si olan
// servislerin logosu görünür, diğerleri baş harf karosunda kalır.
const LOGODEV_KEY = process.env.EXPO_PUBLIC_LOGODEV_KEY;

// Uygulamayla gelen logolar: erişte'nin kendi ikonu (gece varyantı) ağa ve
// Logo.dev'e gitmeden gösterilir.
const LOCAL_LOGOS = {
  "eriste.app": require("../../assets/eriste-logo.png"),
};

function getLogoUri(domain, logoUrl, isDark) {
  if (logoUrl) {
    return logoUrl;
  }

  if (!domain || !LOGODEV_KEY) {
    return null;
  }

  return (
    `https://img.logo.dev/${domain}?token=${LOGODEV_KEY}` +
    `&size=128&format=png&retina=true&fallback=404&theme=${isDark ? "dark" : "light"}`
  );
}

// Servisin gerçek logosu (Logo.dev). Logo kaynağı yoksa ya da yüklenemezse
// kategori pastelli baş harf karosuna (AppTile) düşer.
export function ServiceLogo({ domain, logoUrl, name = "", category, size = 44 }) {
  const { colors, radius, categories, isDark } = useTheme();
  // Yüklenemeyen adres tutulur; kaynak değişirse yeni adres yeniden denenir.
  const [failedUri, setFailedUri] = useState(null);

  const localLogo = LOCAL_LOGOS[domain];
  const uri = localLogo ? null : getLogoUri(domain, logoUrl, isDark);

  if (!localLogo && (!uri || failedUri === uri)) {
    return <AppTile name={name} color={categories[category]} size={size} />;
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.tile,
        backgroundColor: colors.field,
        overflow: "hidden",
      }}
    >
      <Image
        source={localLogo ?? { uri }}
        style={{ width: size, height: size }}
        contentFit={localLogo ? "cover" : "contain"}
        cachePolicy="disk"
        onError={() => setFailedUri(uri)}
      />
    </View>
  );
}

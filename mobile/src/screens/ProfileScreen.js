import { SafeAreaView, Text, View } from "react-native";

import { PillButton } from "../components";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../theme";

// Not: Bu ekranın tam tasarımı (e-posta kartı, gizlilik politikası satırı)
// 4. aşamada eklenecek. Şimdilik sekme navigasyonunu test edebilmek için
// çıkış yap işlevi ile minimal halde.
export default function ProfileScreen() {
  const { colors, spacing, typography } = useTheme();
  const { user, logout } = useAuth();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1, padding: spacing.md, gap: spacing.md }}>
        <Text style={[typography.screenTitle, { color: colors.text }]}>
          Profil
        </Text>
        {user?.email ? (
          <Text style={{ color: colors.text2 }}>{user.email}</Text>
        ) : null}
        <View style={{ flex: 1 }} />
        <PillButton title="Çıkış yap" variant="outline" onPress={logout} />
      </View>
    </SafeAreaView>
  );
}

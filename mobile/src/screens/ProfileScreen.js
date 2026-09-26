import { Linking, ScrollView, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GroupedList, GroupedListRow, PillButton } from "../components";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../theme";

const PRIVACY_URL = "https://abonelik-api.gaziustam.com/privacy.html";

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { colors, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        padding: spacing.md,
        paddingTop: insets.top + spacing.sm,
        paddingBottom: spacing.xl,
      }}
    >
      <Text style={[typography.screenTitle, { color: colors.text, marginBottom: spacing.lg }]}>
        Profil
      </Text>

      <GroupedList style={{ marginBottom: spacing.lg }}>
        <GroupedListRow style={{ justifyContent: "space-between" }}>
          <Text style={{ color: colors.text2 }}>E-posta</Text>
          <Text style={{ color: colors.text, fontWeight: "600" }}>{user?.email}</Text>
        </GroupedListRow>
        <GroupedListRow
          onPress={() => Linking.openURL(PRIVACY_URL)}
          style={{ justifyContent: "space-between" }}
        >
          <Text style={{ color: colors.text, fontWeight: "600" }}>Gizlilik politikası</Text>
          <Text style={{ color: colors.text2, fontSize: 18 }}>›</Text>
        </GroupedListRow>
      </GroupedList>

      <PillButton title="Çıkış yap" variant="outline" onPress={logout} />
    </ScrollView>
  );
}

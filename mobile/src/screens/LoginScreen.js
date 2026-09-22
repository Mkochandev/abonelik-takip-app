import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useAuth } from "../context/AuthContext";
import { useTheme } from "../theme";

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.form}>
        <Text style={styles.title}>Giriş Yap</Text>

        <TextInput
          style={styles.input}
          placeholder="E-posta"
          placeholderTextColor={theme.colors.textSecondary}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Şifre"
          placeholderTextColor={theme.colors.textSecondary}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={theme.colors.accentText} />
          ) : (
            <Text style={styles.buttonText}>Giriş Yap</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkContainer} onPress={() => navigation.navigate("Register")}>
          <Text style={styles.link}>Hesabın yok mu? Kayıt ol</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(theme) {
  const { colors, spacing, radius } = theme;

  return StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: "center",
      backgroundColor: colors.background,
    },
    form: {
      paddingHorizontal: spacing.lg,
    },
    title: {
      fontSize: 30,
      fontWeight: "700",
      color: colors.text,
      marginBottom: spacing.xl,
      textAlign: "center",
    },
    input: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingVertical: spacing.sm + 4,
      marginBottom: spacing.md,
      fontSize: 16,
      color: colors.text,
    },
    button: {
      backgroundColor: colors.accent,
      borderRadius: radius,
      paddingVertical: spacing.md - 2,
      alignItems: "center",
      marginTop: spacing.sm,
    },
    buttonText: {
      color: colors.accentText,
      fontSize: 16,
      fontWeight: "600",
    },
    linkContainer: {
      marginTop: spacing.lg,
      alignItems: "center",
    },
    link: {
      color: colors.accent,
      fontSize: 14,
      fontWeight: "500",
    },
    error: {
      color: colors.error,
      marginBottom: spacing.md,
      textAlign: "center",
      fontSize: 14,
    },
  });
}

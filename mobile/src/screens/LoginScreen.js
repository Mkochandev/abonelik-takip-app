import { useState } from "react";

import { useAuth } from "../context/AuthContext";
import { AuthLayout } from "./AuthLayout";

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
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
    <AuthLayout
      title="Giriş yap"
      email={email}
      onChangeEmail={setEmail}
      password={password}
      onChangePassword={setPassword}
      error={error}
      loading={loading}
      onSubmit={handleLogin}
      linkPrefix="Hesabın yok mu?"
      linkLabel="Kayıt ol"
      onLinkPress={() => navigation.navigate("Register")}
    />
  );
}

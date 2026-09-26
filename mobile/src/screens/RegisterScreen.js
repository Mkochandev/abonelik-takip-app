import { useState } from "react";

import { useAuth } from "../context/AuthContext";
import { AuthLayout } from "./AuthLayout";

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    setError(null);
    setLoading(true);
    try {
      await register(email.trim(), password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Hesap oluştur"
      email={email}
      onChangeEmail={setEmail}
      password={password}
      onChangePassword={setPassword}
      error={error}
      loading={loading}
      onSubmit={handleRegister}
      linkPrefix="Zaten hesabın var mı?"
      linkLabel="Giriş yap"
      onLinkPress={() => navigation.navigate("Login")}
    />
  );
}

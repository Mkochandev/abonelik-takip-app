import { useState } from "react";

import { useAuth } from "../context/AuthContext";
import { AuthLayout, shouldOpenPaywall } from "./AuthLayout";

export default function LoginScreen({ navigation, route }) {
  const { login } = useAuth();
  const promptMessage = route.params?.promptMessage;
  const next = route.params?.next;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError(null);
    setLoading(true);
    try {
      const result = await login(email.trim(), password);
      // Misafir listesi aktarılırken limite takıldıysa ya da kullanıcı buraya
      // misafir limiti ekranından geldiyse Paywall'a geç (premium değilse).
      if (shouldOpenPaywall(result, next)) {
        navigation.replace("Paywall");
      } else {
        navigation.goBack();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Giriş yap"
      promptMessage={promptMessage}
      email={email}
      onChangeEmail={setEmail}
      password={password}
      onChangePassword={setPassword}
      error={error}
      loading={loading}
      onSubmit={handleLogin}
      linkPrefix="Hesabın yok mu?"
      linkLabel="Kayıt ol"
      onLinkPress={() => navigation.replace("Register", { promptMessage, next })}
    />
  );
}

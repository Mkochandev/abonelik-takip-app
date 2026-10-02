import { useState } from "react";

import { useAuth } from "../context/AuthContext";
import { AuthLayout, shouldOpenPaywall } from "./AuthLayout";

export default function RegisterScreen({ navigation, route }) {
  const { register } = useAuth();
  const promptMessage = route.params?.promptMessage;
  const next = route.params?.next;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    setError(null);
    setLoading(true);
    try {
      const result = await register(email.trim(), password);
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
      title="Hesap oluştur"
      promptMessage={promptMessage}
      email={email}
      onChangeEmail={setEmail}
      password={password}
      onChangePassword={setPassword}
      error={error}
      loading={loading}
      onSubmit={handleRegister}
      linkPrefix="Zaten hesabın var mı?"
      linkLabel="Giriş yap"
      onLinkPress={() => navigation.replace("Login", { promptMessage, next })}
    />
  );
}

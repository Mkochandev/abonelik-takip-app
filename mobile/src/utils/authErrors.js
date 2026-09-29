// Backend, Supabase Auth hatalarını olduğu gibi (İngilizce mesaj + varsa
// code) iletir. Yaygın olanları kullanıcıya Türkçe gösteriyoruz; eşleşmeyen
// hatalar orijinal mesajıyla kalır.
const AUTH_ERRORS = [
  {
    codes: ["invalid_credentials"],
    pattern: /invalid login credentials/i,
    message: "E-posta veya şifre hatalı.",
  },
  {
    codes: ["user_already_exists", "email_exists"],
    pattern: /already (registered|exists)/i,
    message: "Bu e-posta adresiyle zaten bir hesap var.",
  },
  {
    codes: ["weak_password"],
    pattern: /password should be at least/i,
    message: "Şifre çok kısa veya zayıf. En az 6 karakter kullan.",
  },
  {
    codes: ["email_not_confirmed"],
    pattern: /email not confirmed/i,
    message: "E-posta adresin henüz doğrulanmadı. Gelen kutundaki bağlantıya tıkla.",
  },
  {
    codes: [],
    pattern: /email ve password zorunludur/i,
    message: "E-posta ve şifre zorunludur.",
  },
];

export function translateAuthError(code, message) {
  const match = AUTH_ERRORS.find(
    (entry) => (code && entry.codes.includes(code)) || (message && entry.pattern.test(message))
  );
  return match ? match.message : message;
}

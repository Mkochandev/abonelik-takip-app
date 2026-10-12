// Backend'in auth hata kodlarını (bkz. backend/src/services/authService.js)
// kullanıcıya Türkçe gösteriyoruz; eşleşmeyen hatalar sunucunun mesajıyla
// kalır.
const AUTH_ERRORS = {
  invalid_credentials: "E-posta veya şifre hatalı.",
  user_already_exists: "Bu e-posta adresiyle zaten bir hesap var.",
  weak_password: "Şifre en az 8 karakter olmalı.",
  password_too_long: "Şifre çok uzun.",
  invalid_email: "Geçerli bir e-posta adresi gir.",
  missing_credentials: "E-posta ve şifre zorunludur.",
  invalid_refresh_token: "Oturumun sona erdi, tekrar giriş yap.",
  invalid_reset_token: "Bağlantı geçersiz ya da süresi dolmuş.",
  rate_limited: "Çok fazla deneme yaptın. Biraz bekleyip tekrar dene.",
};

export function translateAuthError(code, message) {
  return (code && AUTH_ERRORS[code]) || message;
}

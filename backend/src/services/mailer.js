// E-posta gönderimi. RESEND_API_KEY tanımlıysa Resend ile gönderir; yoksa
// (geliştirme) e-postanın içeriğini loga yazar. Gönderen adres MAIL_FROM.

const RESEND_URL = "https://api.resend.com/emails";
const DEFAULT_FROM = "erişte <noreply@eriste.app>";

async function sendMail({ to, subject, text, html }) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(`[mailer] RESEND_API_KEY yok, e-posta gönderilmedi.\n  Kime: ${to}\n  Konu: ${subject}\n${text}`);
    return;
  }

  const response = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM || DEFAULT_FROM,
      to: [to],
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Resend isteği başarısız (${response.status}): ${body}`);
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendPasswordResetEmail(to, link, validMinutes) {
  const subject = "erişte şifre sıfırlama";
  const text = [
    "Merhaba,",
    "",
    "erişte hesabın için şifre sıfırlama isteği aldık. Yeni şifreni belirlemek için:",
    link,
    "",
    `Bağlantı ${validMinutes} dakika geçerli ve tek kullanımlık.`,
    "Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin; şifren değişmez.",
  ].join("\n");
  const html = `<p>Merhaba,</p>
<p>erişte hesabın için şifre sıfırlama isteği aldık. Yeni şifreni belirlemek için:</p>
<p><a href="${escapeHtml(link)}">Şifremi sıfırla</a></p>
<p>Bağlantı ${validMinutes} dakika geçerli ve tek kullanımlık.<br>
Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin; şifren değişmez.</p>`;

  await sendMail({ to, subject, text, html });
}

module.exports = { sendMail, sendPasswordResetEmail };

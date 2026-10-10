import { MONTH_NAMES } from "../utils/billing";
import { formatAmount, formatSubscriptionPrice, formatTRY } from "../utils/price";
import {
  PAYMENT_CHANNELS,
  REASON_OPTIONS,
  REMINDER_DAY_OPTIONS,
  SHARE_OPTIONS,
  USAGE_FREQUENCIES,
} from "./subscriptionFields";

// Kıvırık sorularının metinleri ve seçenekleri. Hangi sorunun ne zaman
// sorulacağını backend hesaplar (backend/src/kivirik/questions.js); burada
// yalnızca gösterim durur.
//
// Servis adına asla ek getirilmez: ad, kartın üstündeki şeritte görünür;
// soru metni onu tekrar etmez.
//
// Seçenek: { answer, label, hint?, input? }
//   input: "amount" | "date" | "text" — seçilince seçeneklerin yerine giriş
//   alanı + Kaydet çıkar; cevap { answer, value } olarak gönderilir.
// picker: "billing" — kart gün seçiciyi gösterir (answer = "set").
//   dismiss: "tomorrow" — cevap değil, erteleme (ör. "Yarın tekrar hatırlat").
// bubble: tetiklemeli sorularda ana sayfa balonunun metni (servis adı
// eksiz, cümlenin sonunda).
// badge(p): kartın üstündeki etiket { tone: "price" | "trial", label, detail }.
// mood: Kıvırık'ın yüzü (normal | dusunceli | sasirmis).
// action(answer): cevaptan sonra "guide" (iptal rehberi), "refund" (iade
//   adımları) ya da "cheaper" (servisin planları, fiyata göre).
// followUp(answer): true ise aynı kartta FOLLOW_UP_UNUSED sorulur.

// "15 Ekim" (yıl yok; kısa vadeli tarihler için).
function shortDate(iso) {
  const [, month, day] = iso.split("-").map(Number);
  return `${day} ${MONTH_NAMES[month - 1]}`;
}

function changedLabel(daysAgo) {
  if (daysAgo <= 0) return "Bugün fark ettim";
  if (daysAgo === 1) return "Dün fark ettim";
  return `${daysAgo} gün önce fark ettim`;
}

// Kullanılmayan bir abonelik için takip sorusu (cevap kaydedilmez).
export const FOLLOW_UP_UNUSED = {
  text: (p) => `Yılda ${formatTRY(p.yearly_try)} ediyor. İptal adımlarına bakalım mı?`,
  note: () => "Kullanmadığın bir abonelik için bu biraz fazla.",
  options: () => [
    { answer: "guide", label: "İptal adımlarını göster", hint: "İptal sayfasını senin için açarım" },
    { answer: "keep", label: "Kalsın, kullanacağım" },
  ],
};

export const KIVIRIK_QUESTIONS = {
  trial_ending: {
    text: (p) =>
      p.days_left <= 0
        ? "Denemen bugün bitiyor."
        : p.days_left === 1
          ? "Denemen yarın bitiyor."
          : `Denemen ${p.days_left} gün sonra bitiyor.`,
    note: (p) =>
      `İptal etmezsen ${shortDate(p.trial_ends_at)} günü ${formatSubscriptionPrice(p).primary} çekilecek.`,
    bubble: (p) => `Bir denemen bitmek üzere: ${p.app_name}. Devam mı, iptal mi?`,
    badge: (p) => ({
      tone: "trial",
      label: "Deneme bitiyor",
      detail: p.days_left <= 0 ? "Bugün" : `${p.days_left} gün kaldı`,
    }),
    mood: "dusunceli",
    options: () => [
      { answer: "continue", label: "Devam edeceğim", hint: "Ödeme gününü deneme bitişine ayarlarım" },
      { answer: "cancel", label: "İptal edeceğim" },
      { answer: "tomorrow", label: "Yarın tekrar hatırlat", dismiss: "tomorrow" },
    ],
    action: (answer) => (answer === "cancel" ? "guide" : null),
  },
  cancel_verify: {
    text: () => "Bu aboneliği iptal etmiştin. Bu ay kartından çekim oldu mu?",
    bubble: (p) => `İptal ettiğin bir abonelik için sorum var: ${p.app_name}. Bu ay kartından çekim oldu mu?`,
    mood: "dusunceli",
    options: () => [
      { answer: "no", label: "Hayır" },
      { answer: "yes", label: "Evet", hint: "Ne yapabileceğini adım adım göstereyim" },
    ],
    action: (answer) => (answer === "yes" ? "refund" : null),
  },
  price_increase: {
    text: () => "Zamlandı. Ne yapıyoruz?",
    note: (p) =>
      `Ayda ${formatAmount(p.monthly_diff, p.price_currency)}, yılda ${formatAmount(p.yearly_diff, p.price_currency)} fazla.`,
    bubble: (p) => `Zam geldi: ${p.app_name}. Ne yapıyoruz?`,
    badge: (p) => ({ tone: "price", label: "Zam", detail: changedLabel(p.changed_days_ago) }),
    mood: "sasirmis",
    options: () => [
      { answer: "keep", label: "Devam, kalsın" },
      { answer: "cheaper", label: "Daha ucuz plana bakayım" },
      { answer: "leave", label: "Bırakacağım" },
    ],
    action: (answer) => (answer === "cheaper" ? "cheaper" : answer === "leave" ? "guide" : null),
  },
  monthly_usage_check: {
    text: () => "Bu ay açtın mı?",
    options: () => [
      { answer: "often", label: "Çok" },
      { answer: "few", label: "Birkaç kez" },
      { answer: "never", label: "Hiç" },
    ],
    followUp: (answer) => answer === "never",
  },
  value_check: {
    text: () => "Parasını hak ediyor mu?",
    mood: "dusunceli",
    options: () => [
      { answer: "yes", label: "Kesinlikle" },
      { answer: "meh", label: "İdare eder" },
      { answer: "no", label: "Hayır" },
    ],
    followUp: (answer) => answer === "no",
  },
  billing_day: {
    text: (p) =>
      p.billing_cycle === "yearly" ? "Para yılın hangi günü çekiliyor?" : "Para ayın kaçında çekiliyor?",
    picker: "billing",
    options: () => [{ answer: "unknown", label: "Bilmiyorum" }],
  },
  payment_channel: {
    text: () => "Nereden ödüyorsun?",
    note: () => "İptal etmek istersen doğru yere götürürüm.",
    options: () => PAYMENT_CHANNELS.map((c) => ({ answer: c.value, label: c.label, hint: c.hint })),
  },
  usage_frequency: {
    text: () => "Ne sıklıkla açıyorsun?",
    options: () => USAGE_FREQUENCIES.map((f) => ({ answer: f.value, label: f.label })),
    followUp: (answer) => answer === "Neredeyse hiç",
  },
  reminder_days_before: {
    text: () => "Ödemeden ne kadar önce haber vereyim?",
    options: () =>
      REMINDER_DAY_OPTIONS.map((o) => ({
        answer: String(o.value),
        label: o.value === 0 ? "Aynı gün" : o.label.replace(" önce", ""),
      })),
  },
  price_confirm: {
    text: (p) => `Senin için ${formatSubscriptionPrice(p).primary} görünüyor. Doğru mu?`,
    options: () => [
      { answer: "yes", label: "Evet, doğru" },
      { answer: "no", label: "Hayır, farklı ödüyorum", input: "amount" },
    ],
    inputLabel: () => "Ne kadar ödüyorsun?",
    inputNote: () => "Toplamlarda senin tutarın kullanılır. Fiyatı ben de bir daha kontrol ederim.",
  },
  share_count: {
    text: () => "Bunu biriyle paylaşıyor musun?",
    options: () => SHARE_OPTIONS.map((o) => ({ answer: o.value, label: o.label })),
  },
  is_trial: {
    text: () => "Bu şu an ücretsiz deneme mi?",
    options: () => [
      { answer: "no", label: "Hayır" },
      { answer: "yes", label: "Evet", input: "date" },
    ],
    inputLabel: () => "Deneme ne zaman bitiyor?",
  },
  planned_end: {
    text: () => "Bunu belli bir süre için mi aldın?",
    options: () => [
      { answer: "no", label: "Hayır, sürekli" },
      { answer: "yes", label: "Evet", input: "date" },
    ],
    inputLabel: () => "Hangi gün bırakmayı planlıyorsun?",
  },
  reason: {
    text: () => "Ne için kullanıyorsun?",
    options: (p) => [
      ...(REASON_OPTIONS[p.category] || []).map((label) => ({ answer: "set", value: label, label })),
      { answer: "set", label: "Kendim yazayım", input: "text" },
    ],
    inputLabel: () => "Ne için kullanıyorsun?",
  },
  is_student: {
    text: () => "Öğrenci misin?",
    options: () => [
      { answer: "yes", label: "Evet" },
      { answer: "no", label: "Hayır" },
    ],
  },
  monthly_budget: {
    text: () => "Aboneliklere aylık bir sınırın var mı?",
    options: () => [
      { answer: "none", label: "Yok" },
      { answer: "set", label: "Tutar gir", input: "amount" },
    ],
    inputLabel: () => "Aylık sınırın ne kadar?",
  },
  store_check: {
    text: () => "Telefonundaki aboneliklere bir bakalım mı?",
    note: () => "Eklemediğin kalmış olabilir.",
    options: () => [
      { answer: "open", label: "Aboneliklerimi aç" },
      { answer: "later", label: "Sonra" },
    ],
  },
};

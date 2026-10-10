import { formatSubscriptionPrice } from "../utils/price";
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
// bubble: tetiklemeli sorularda ana sayfa balonunun metni (servis adı
// eksiz, cümlenin sonunda).

export const KIVIRIK_QUESTIONS = {
  cancel_verify: {
    text: () => "Bu aboneliği iptal etmiştin. Bu ay kartından çekim oldu mu?",
    bubble: (p) => `İptal ettiğin bir abonelik için sorum var: ${p.app_name}. Bu ay kartından çekim oldu mu?`,
    options: () => [
      { answer: "no", label: "Hayır" },
      { answer: "yes", label: "Evet", hint: "Ne yapabileceğini adım adım göstereyim" },
    ],
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

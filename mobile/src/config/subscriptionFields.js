// Abonelik alanlarının seçenekleri. value'lar veritabanındaki CHECK
// kısıtlarıyla aynı (bkz. backend/db/migrations/0013).

export const USAGE_FREQUENCIES = [
  { value: "Her gün", label: "Her gün" },
  { value: "Haftada birkaç kez", label: "Haftada birkaç kez" },
  { value: "Ayda birkaç kez", label: "Ayda birkaç kez" },
  { value: "Neredeyse hiç", label: "Neredeyse hiç" },
];

export const PAYMENT_CHANNELS = [
  { value: "app_store", label: "App Store" },
  { value: "google_play", label: "Google Play" },
  { value: "web_card", label: "Sitesinden, kartla" },
  { value: "operator", label: "Operatör faturası" },
  { value: "someone_else", label: "Başkası ödüyor", hint: "Toplamına katmam" },
];

export function paymentChannelLabel(value) {
  return PAYMENT_CHANNELS.find((channel) => channel.value === value)?.label ?? null;
}

// share_count: 1 = paylaşmıyor. "3-4 kişi" 3, "5+" 5 olarak saklanır.
export const SHARE_OPTIONS = [
  { value: "1", label: "Hayır" },
  { value: "2", label: "2 kişi" },
  { value: "3", label: "3-4 kişi" },
  { value: "5", label: "5+" },
];

export function shareLabel(count) {
  if (!count || count <= 1) return "Paylaşmıyorum";
  if (count === 2) return "2 kişi";
  if (count < 5) return "3-4 kişi";
  return "5+ kişi";
}

export const REMINDER_DAY_OPTIONS = [
  { value: 0, label: "Aynı gün" },
  { value: 1, label: "1 gün önce" },
  { value: 3, label: "3 gün önce" },
  { value: 7, label: "1 hafta önce" },
];

// Kategoriye göre "ne için kullanıyorsun?" seçenekleri (ekleme sayfası ve
// Kıvırık'ın reason sorusu).
export const REASON_OPTIONS = {
  "Video/Dizi-Film": [
    "Belirli bir dizi/film için",
    "Genel eğlence takibi",
    "Aile/ev arkadaşıyla ortak",
    "Spor/belgesel içerikleri",
  ],
  Müzik: ["Günlük müzik dinleme", "Playlist/podcast takibi", "Reklamsız dinleme", "Offline indirme"],
  "Kitap/Sesli Kitap": [
    "Belirli bir kitap/seri için",
    "Düzenli okuma alışkanlığı",
    "Yolda/işte dinleme",
  ],
  "Yapay Zeka": ["İş/proje için", "Kod yazarken yardım", "Öğrenme/araştırma", "Kişisel kullanım"],
  "Bulut Depolama": [
    "Fotoğraf/video yedekleme",
    "Cihazlar arası senkronizasyon",
    "İş dosyaları için",
  ],
  "Üretkenlik/Tasarım": ["İş projeleri için", "Freelance/müşteri işleri", "Kişisel hobi", "Okul/eğitim"],
  Oyun: ["Online oynamak için", "Oyun kütüphanesi", "Belirli bir oyun için", "Bulut depolama/kayıtlar"],
  "Alışveriş/Üyelik": ["Ücretsiz kargo", "İndirim ve kampanyalar", "Yemek siparişi", "Ek üyelik avantajları"],
  "VPN/Güvenlik": ["Gizlilik", "Erişim engelini aşmak", "Halka açık Wi-Fi'da güvenlik", "Şifre yönetimi"],
  Spor: ["Maç takibi", "Belirli bir takım/lig için", "Genel spor içerikleri", "Antrenman takibi"],
};

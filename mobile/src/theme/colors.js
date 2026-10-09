// Açık gri zemin üstünde beyaz kartlar; hiyerarşi renk yerine boyut/kalınlıkla
// kurulur. Renk yalnızca ikonlarda ve küçük vurgularda kullanılır.

export const lightColors = {
  bg: "#F2F1F4",
  card: "#FFFFFF",
  text: "#15131A",
  text2: "#5F5B66",
  divider: "#E6E4EA",
  field: "#F2F1F4",
  primary: "#15131A",
  onPrimary: "#FFFFFF",
  accent: "#FFC53D",
  onAccent: "#15131A",
  // Bilgi kutuları gibi zeminden ayrışması gereken yumuşak vurgu yüzeyi.
  accentSoft: "#FFF0C7",
  danger: "#B4271F", // biberYazi: açık zeminde okunur kırmızı
  switchOff: "#C9C5CF",
  scrim: "rgba(21,19,26,0.5)",
};

export const darkColors = {
  bg: "#0F0E13",
  card: "#1C1A22",
  text: "#F5F3F7",
  text2: "#A9A5B0",
  divider: "#2E2B35",
  field: "#26232D",
  primary: "#FFC53D",
  onPrimary: "#15131A",
  accent: "#FFC53D",
  onAccent: "#15131A",
  accentSoft: "#3A3122",
  danger: "#FF7A66",
  switchOff: "#4A4652",
  scrim: "rgba(0,0,0,0.6)",
};

// İki modda da aynı kalan marka renkleri.
export const brandColors = {
  ink: "#15131A",
  safran: "#FFC53D",
  biber: "#C8312A",
  biberYazi: "#B4271F", // açık zeminde kırmızı yazı (kontrast için)
  krem: "#F6EEDC",
  mandalina: "#FF8A3D",
  odun: "#E2B07A",
};

// Sistem temasından bağımsız, her zaman koyu zeminli ekranlar (Welcome,
// Summary, Giriş/Kayıt) için: koyu tema paleti, zemin ink.
export const nightColors = {
  ...darkColors,
  bg: brandColors.ink,
};

// Kategori pastelleri; üstlerindeki ikon/harf her zaman ink (#15131A).
export const categoryColors = {
  "Video/Dizi-Film": "#D7D2FB",
  Müzik: "#F9D0E6",
  "Kitap/Sesli Kitap": "#FFD9B8",
  "Yapay Zeka": "#C6EEDF",
  "Bulut Depolama": "#CFE5FB",
  "Üretkenlik/Tasarım": "#FBE7A8",
  Oyun: "#DCEFB0",
  "Alışveriş/Üyelik": "#E8DCC8",
  "VPN/Güvenlik": "#D5DCE8",
  Spor: "#FFD0CC",
};

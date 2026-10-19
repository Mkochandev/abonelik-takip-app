// Kategori ikonları: 24px çizgi ikon path'leri (react-native-svg ile çizilir).
export const categoryIconPaths = {
  "Video/Dizi-Film": [
    "M6 5h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z",
    "M10 9.5v5l4.5-2.5z",
  ],
  Müzik: [
    "M9 18V6l10-2v12",
    "M9 18a2.5 2.5 0 1 1-5 0a2.5 2.5 0 1 1 5 0",
    "M19 16a2.5 2.5 0 1 1-5 0a2.5 2.5 0 1 1 5 0",
  ],
  "Kitap/Sesli Kitap": [
    "M3 5.5C6 4.5 9 4.8 12 6.5c3-1.7 6-2 9-1v13c-3-1-6-.7-9 1-3-1.7-6-2-9-1z",
    "M12 6.5v13",
  ],
  "Yapay Zeka": [
    "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
    "M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z",
  ],
  "Bulut Depolama": [
    "M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6 9.5 4.25 4.25 0 0 0 7 18z",
  ],
  "Üretkenlik/Tasarım": ["M4 20l1-4L16 5l3 3L8 19z", "M14 7l3 3"],
  Oyun: [
    "M7 8h10a4 4 0 0 1 4 4v1.5a3.5 3.5 0 0 1-6.3 2.1L13.5 14h-3l-1.2 1.6A3.5 3.5 0 0 1 3 13.5V12a4 4 0 0 1 4-4z",
    "M8 10.5v3M6.5 12h3",
    "M15.5 11h.01M17.5 13h.01",
  ],
  "Alışveriş/Üyelik": ["M5 8h14l-1.2 12H6.2z", "M9 8V6.5a3 3 0 0 1 6 0V8"],
  "VPN/Güvenlik": ["M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z", "M9 12l2 2 4-4"],
  Spor: [
    "M12 3.5a8.5 8.5 0 1 1 0 17a8.5 8.5 0 1 1 0-17z",
    "M3.5 12h17",
    "M12 3.5c2.5 2.5 2.5 14.5 0 17M12 3.5c-2.5 2.5-2.5 14.5 0 17",
  ],
  "Eğitim/Dil": [
    "M2.5 9L12 4.5 21.5 9 12 13.5z",
    "M6.5 11.2v4.3c1.5 1.6 3.4 2.4 5.5 2.4s4-.8 5.5-2.4v-4.3",
    "M21.5 9v5",
  ],
  "Sağlık/Meditasyon": [
    "M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z",
    "M7.5 12h2.5l1.5-2.5 2 4 1.5-1.5h1.5",
  ],
  "Haber/Gazete": [
    "M4 5h12v13a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2z",
    "M16 9h3a1 1 0 0 1 1 1v8a2 2 0 0 1-4 0",
    "M7.5 9h5M7.5 12.5h5M7.5 16h3",
  ],
  "Yazılım/Geliştirici": ["M8.5 7.5L4 12l4.5 4.5", "M15.5 7.5L20 12l-4.5 4.5", "M13.5 5l-3 14"],
  "Sosyal/Tanışma": [
    "M12.5 7.5a3.5 3.5 0 1 1-7 0a3.5 3.5 0 1 1 7 0",
    "M3 19c.8-3.2 3.1-5 6-5s5.2 1.8 6 5",
    "M16 4.5a3 3 0 0 1 0 6",
    "M18 14c1.6.6 2.6 2.1 3 4",
  ],
  Diğer: ["M5 5h5v5H5z", "M14 5h5v5h-5z", "M5 14h5v5H5z", "M14 14h5v5h-5z"],
};

// Uygulamanın tanımadığı (ör. sonradan panelden eklenen) kategoriler için
// nötr ikon: daire içinde üç nokta.
export const fallbackCategoryIconPaths = [
  "M4 12a8 8 0 1 0 16 0a8 8 0 1 0-16 0",
  "M8.5 12h.01M12 12h.01M15.5 12h.01",
];

export function getCategoryIconPaths(category) {
  return categoryIconPaths[category] ?? fallbackCategoryIconPaths;
}

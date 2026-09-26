// Marka işaretinin ham path/kare verisi: 512x512 viewBox'ta tek doğruluk
// kaynağı. Hem BrandIcon/LogoMark bileşenleri hem de
// scripts/generate-icons.js bu dosyayı kullanır (Node ile de doğrudan
// require edilebilsin diye CommonJS export).

const NOODLE_PATH =
  "M 54.0 318.0 C 56.0 314.2 62.0 300.7 66.0 295.4 C 70.0 290.0 74.0 286.0 78.0 286.0 C 82.0 286.0 86.0 290.0 90.0 295.4 C 94.0 300.7 98.0 310.5 102.0 318.0 C 106.0 325.5 110.0 335.3 114.0 340.6 C 118.0 346.0 122.0 350.0 126.0 350.0 C 130.0 350.0 134.0 346.0 138.0 340.6 C 142.0 335.3 146.0 325.5 150.0 318.0 C 154.0 310.5 158.0 300.7 162.0 295.4 C 166.0 290.0 170.0 286.0 174.0 286.0 C 178.0 286.0 182.0 290.0 186.0 295.4 C 190.0 300.7 194.0 310.5 198.0 318.0 C 202.0 325.5 206.0 335.3 210.0 340.6 C 214.0 346.0 218.0 350.0 222.0 350.0 C 226.0 350.0 230.0 346.0 234.0 340.6 C 238.0 335.3 242.0 325.5 246.0 318.0 C 250.0 310.5 254.0 300.7 258.0 295.4 C 262.0 290.0 268.0 287.6 270.0 286.0";

const SQUARES = [
  { x: 331.1, y: 278, rotate: -16.5, fill: "#FFC53D" },
  { x: 391.4, y: 243.5, rotate: -43.8, fill: "#FF8A3D" },
  { x: 429.5, y: 187.7, rotate: -65.8, fill: "#FF5E57" },
];

// Noktalar kabaca yol/kare köşelerinden hesaplanmış (kontrol noktaları
// hariç) sınır kutusu; ikon üretiminde işareti tuvale ortalamak için
// kullanılır.
const MARK_BOUNDS = { minX: 40, maxX: 466.27, minY: 150.93, maxY: 364 };

module.exports = { NOODLE_PATH, SQUARES, MARK_BOUNDS };

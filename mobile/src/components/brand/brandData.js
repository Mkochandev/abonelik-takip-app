// Marka çiziminin ham verisi: tek doğruluk kaynağı. Hem React Native
// bileşenleri (NoodleBackground, BrandLogo) hem de
// scripts/generate-brand-assets.mjs bu dosyayı kullanır; Node'dan da doğrudan
// içe aktarılabilsin diye CommonJS export.

// 512x512'lik erişte deseni: [path, kalınlık]
const NOODLES = [
  ["M-20 60 C60 30 120 100 200 70 C280 40 340 110 420 80 C470 62 500 90 540 70", 12],
  ["M-20 128 C70 158 130 98 210 138 C290 178 360 108 440 148 C490 170 520 138 540 148", 11],
  ["M-20 432 C80 402 150 472 230 442 C310 412 370 482 450 447 C500 427 520 462 540 452", 12],
  ["M-20 486 C60 506 140 456 220 491 C300 526 380 461 460 496 C500 511 520 486 540 496", 11],
  ["M40 540 C70 460 10 400 50 320 C80 260 20 200 60 120 C80 70 40 30 60 -20", 12],
  ["M470 540 C440 470 500 400 460 330 C430 270 490 210 455 140 C440 90 480 40 460 -20", 12],
  ["M120 540 C142 496 98 468 128 416 C146 386 120 364 132 340", 11],
  ["M392 540 C370 494 412 468 386 418 C372 390 396 368 384 344", 11],
  ["M-20 300 C60 250 100 340 160 300 C200 272 180 222 140 232 C112 240 118 276 146 274", 11],
  ["M540 262 C460 302 430 222 372 262 C334 290 352 340 390 330 C414 322 406 296 384 300", 11],
  ["M204 -20 C182 30 222 62 200 112", 10],
  ["M334 -20 C356 30 312 72 336 118", 10],
  ["M264 -20 C250 20 286 40 270 78", 9],
  ["M-20 372 C40 352 70 392 112 368 C150 346 170 380 200 372", 10],
  ["M540 398 C480 380 450 420 404 396 C368 378 344 404 320 396", 10],
  ["M186 540 C200 498 236 512 246 470 C254 440 284 452 296 430", 10],
  ["M-20 210 C30 190 50 230 90 214", 9],
  ["M540 196 C496 180 476 216 436 204", 9],
];

// BrandLogo varyantları.
const LOGO_VARIANTS = {
  gece: { bg: "#15131A", noodle: "#FFC53D", shine: "#FFE08A", text: "#F5F3F7", stick: "#E2B07A" },
  biber: { bg: "#C8312A", noodle: "#FFC53D", shine: "#FFE08A", text: "#FFF6DC", stick: "#F6EEDC" },
  kagit: { bg: "#F6EEDC", noodle: "#EDA82A", shine: "#FFD873", text: "#C8312A", stick: "#15131A" },
};

// Yemek çubukları (512 viewBox).
const STICKS = ["M96 150 L452 92", "M104 178 L462 122"];

// "erişte" yazısının yerleşimi (512 viewBox).
const WORDMARK = { x: 256, y: 318, fontSize: 128, width: 396, haloWidth: 30 };

// Parlama telinin kalınlığı, ana tel kalınlığından türetilir.
function shineWidth(width) {
  return Math.max(2.5, Math.round(width * 0.28));
}

module.exports = { NOODLES, LOGO_VARIANTS, STICKS, WORDMARK, shineWidth };

// BrandLogo çiziminden (src/components/brand/) uygulama ikonu, Android
// adaptive icon, açılış ekranı ve favicon PNG'lerini üretir.
//
//   npm run brand:assets
//
// @resvg/resvg-js yalnızca bu script için gereken bir devDependency; üretilen
// PNG'ler commit'lenir, script build sırasında tekrar çalıştırılmaz.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

import brandData from "../src/components/brand/brandData.js";

const { NOODLES, LOGO_VARIANTS, STICKS, WORDMARK, shineWidth } = brandData;

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS_DIR = path.join(ROOT, "assets");
const FONT_FILE = require.resolve(
  "@expo-google-fonts/bricolage-grotesque/800ExtraBold/BricolageGrotesque_800ExtraBold.ttf"
);
const FONT_FAMILY = "Bricolage Grotesque";
const APP_NAME = "erişte";

// Android maskesi kenarları kırptığı için adaptive icon'da yazı ve çubuklar
// bu oranla küçültülüp ortalanır; teller tüm alanı kaplamaya devam eder.
// 0.66: çubuk uçları dahil içerik, 108dp katmandaki 66dp çaplı güvenli
// dairenin (yarıçap ~156/512) içinde kalır; 0.8'de yuvarlak maskede kesiliyordu.
const ADAPTIVE_CONTENT_SCALE = 0.66;
// Yazı + çubukların 512'lik viewBox'taki yaklaşık sınır kutusu (konturlar dahil).
const CONTENT_BOUNDS = { minX: 58, maxX: 469, minY: 78, maxY: 350 };

function noodles(v) {
  const base = NOODLES.map(
    ([d, w]) =>
      `<path d="${d}" stroke="${v.noodle}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
  ).join("");
  const shine = NOODLES.map(
    ([d, w]) =>
      `<path d="${d}" stroke="${v.shine}" stroke-width="${shineWidth(w)}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
  ).join("");
  return `${base}<g transform="translate(-2 -2)" opacity="0.75">${shine}</g>`;
}

// Yazı ve çubuklar. halo: yazı/çubukların etrafındaki boşluğu açan zemin rengi.
function wordmarkAndSticks({ text, stick, halo }) {
  const attrs = `x="${WORDMARK.x}" y="${WORDMARK.y}" text-anchor="middle" font-family="${FONT_FAMILY}" font-weight="800" font-size="${WORDMARK.fontSize}" textLength="${WORDMARK.width}" lengthAdjust="spacingAndGlyphs"`;
  const haloText = `<text ${attrs} fill="${halo}" stroke="${halo}" stroke-width="${WORDMARK.haloWidth}" stroke-linejoin="round">${APP_NAME}</text>`;
  const fillText = `<text ${attrs} fill="${text}">${APP_NAME}</text>`;
  const stickHalos = STICKS.map(
    (d) => `<path d="${d}" stroke="${halo}" stroke-width="30" stroke-linecap="round" fill="none"/>`
  ).join("");
  const sticks = STICKS.map(
    (d) => `<path d="${d}" stroke="${stick}" stroke-width="14" stroke-linecap="round" fill="none"/>`
  ).join("");
  return `${haloText}${fillText}${stickHalos}${sticks}`;
}

// İçeriği (yazı + çubuklar) 512'lik tuvalin ortasına scale oranında yerleştirir.
function centerContent(scale) {
  const cx = (CONTENT_BOUNDS.minX + CONTENT_BOUNDS.maxX) / 2;
  const cy = (CONTENT_BOUNDS.minY + CONTENT_BOUNDS.maxY) / 2;
  return `translate(${(256 - cx * scale).toFixed(2)} ${(256 - cy * scale).toFixed(2)}) scale(${scale})`;
}

function logoSvg({ size, variant = "gece", radius = 0, contentScale = null }) {
  const v = LOGO_VARIANTS[variant];
  const content = wordmarkAndSticks({ text: v.text, stick: v.stick, halo: v.bg });
  const placed = contentScale ? `<g transform="${centerContent(contentScale)}">${content}</g>` : content;
  const clip = radius > 0 ? `<clipPath id="c"><rect width="512" height="512" rx="${radius}"/></clipPath>` : "";
  const clipAttr = radius > 0 ? ` clip-path="url(#c)"` : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
    <defs>${clip}</defs>
    <g${clipAttr}>
      <rect width="512" height="512" fill="${v.bg}"/>
      ${noodles(v)}
      ${placed}
    </g>
  </svg>`;
}

// Açılış ekranı: şeffaf zeminde yalnızca yazı ve çubuklar. Halo rengi splash
// zeminiyle (#15131A) aynı olduğundan görünmez, yalnızca kesişimleri ayırır.
function splashSvg({ size }) {
  const v = LOGO_VARIANTS.gece;
  const content = wordmarkAndSticks({ text: v.text, stick: v.stick, halo: v.bg });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
    <g transform="${centerContent(0.92)}">${content}</g>
  </svg>`;
}

function render(svg, fileName) {
  const resvg = new Resvg(svg, {
    background: "rgba(0,0,0,0)",
    font: { fontFiles: [FONT_FILE], loadSystemFonts: false, defaultFontFamily: FONT_FAMILY },
  });
  const outPath = path.join(ASSETS_DIR, fileName);
  fs.writeFileSync(outPath, resvg.render().asPng());
  console.log("yazıldı:", path.relative(ROOT, outPath));
}

// iOS köşeleri kendisi yuvarlar: köşesiz kare.
render(logoSvg({ size: 1024 }), "icon.png");
render(logoSvg({ size: 1024, contentScale: ADAPTIVE_CONTENT_SCALE }), "adaptive-icon.png");
render(splashSvg({ size: 1024 }), "splash-icon.png");
render(logoSvg({ size: 64, radius: 114 }), "favicon.png");

console.log("Tamamlandı.");

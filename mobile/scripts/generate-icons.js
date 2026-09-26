// Marka işaretinden (src/components/brandPaths.js) uygulama ikonu, açılış
// ekranı ve Android adaptive icon PNG'lerini üretir.
//
//   node scripts/generate-icons.js
//
// @resvg/resvg-js yalnızca bu script için gereken geçici bir devDependency;
// üretilen PNG'ler commit'lenir, script build sırasında tekrar çalıştırılmaz.

const fs = require("fs");
const path = require("path");
const { Resvg } = require("@resvg/resvg-js");

const { NOODLE_PATH, SQUARES, MARK_BOUNDS } = require("../src/components/brandPaths");

const INK = "#15131A";
const ASSETS_DIR = path.join(__dirname, "..", "assets");
const LOGO_DIR = path.join(ASSETS_DIR, "logo");

function markGroup(color) {
  const squares = SQUARES.map(
    (sq) =>
      `<rect x="-26" y="-26" width="52" height="52" rx="15" fill="${color ?? sq.fill}" transform="translate(${sq.x} ${sq.y}) rotate(${sq.rotate})" />`
  ).join("\n");

  return `
    <path d="${NOODLE_PATH}" stroke="${color ?? "#FFC53D"}" stroke-width="28" stroke-linecap="round" stroke-linejoin="round" fill="none" />
    ${squares}
  `;
}

// İşareti verilen oranda tuvale ortalayan transform (Android safe-zone gibi
// kısıtlamalar için fraction düşürülür).
function centerTransform(fraction) {
  const bboxW = MARK_BOUNDS.maxX - MARK_BOUNDS.minX;
  const bboxH = MARK_BOUNDS.maxY - MARK_BOUNDS.minY;
  const bboxCenterX = (MARK_BOUNDS.minX + MARK_BOUNDS.maxX) / 2;
  const bboxCenterY = (MARK_BOUNDS.minY + MARK_BOUNDS.maxY) / 2;

  const target = 512 * fraction;
  const scale = target / Math.max(bboxW, bboxH);
  const dx = 256 - bboxCenterX * scale;
  const dy = 256 - bboxCenterY * scale;

  return `translate(${dx.toFixed(2)} ${dy.toFixed(2)}) scale(${scale.toFixed(4)})`;
}

function svg({ size, background, color, fraction }) {
  const bg = background ? `<rect width="512" height="512" rx="114" fill="${background}" />` : "";
  const transform = fraction ? centerTransform(fraction) : null;
  const mark = transform
    ? `<g transform="${transform}">${markGroup(color)}</g>`
    : markGroup(color);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">${bg}${mark}</svg>`;
}

function render(svgString, outPath) {
  const resvg = new Resvg(svgString, { background: "rgba(0,0,0,0)" });
  const png = resvg.render().asPng();
  fs.writeFileSync(outPath, png);
  console.log("yazıldı:", path.relative(process.cwd(), outPath));
}

fs.mkdirSync(LOGO_DIR, { recursive: true });

// 1) Uygulama ikonu: dolu ink zeminli renkli karo.
render(svg({ size: 1024, background: INK }), path.join(ASSETS_DIR, "icon.png"));

// 2) Favicon: aynı karo, küçük boyut.
render(svg({ size: 64, background: INK }), path.join(ASSETS_DIR, "favicon.png"));

// 3) Splash ekranı: şeffaf zemin, işaret ortalanmış (zemin rengini
//    app.config.js'teki splash.backgroundColor karşılıyor).
render(svg({ size: 900, fraction: 0.8 }), path.join(ASSETS_DIR, "splash-icon.png"));

// 4) Android adaptive icon ön planı: renkli işaret, safe-zone'a göre küçültülmüş.
render(svg({ size: 1024, fraction: 0.6 }), path.join(ASSETS_DIR, "android-icon-foreground.png"));

// 5) Android monochrome ikon: tek renk (beyaz) işaret, safe-zone'a göre küçültülmüş.
render(
  svg({ size: 1024, fraction: 0.6, color: "#FFFFFF" }),
  path.join(ASSETS_DIR, "android-icon-monochrome.png")
);

// 6) Marka klasörü: tek renkli kullanım için ham işaret PNG'leri.
render(svg({ size: 512, fraction: 0.8, color: "#000000" }), path.join(LOGO_DIR, "isaret-siyah.png"));
render(
  svg({ size: 512, fraction: 0.8, color: "#FFFFFF" }),
  path.join(LOGO_DIR, "isaret-kare-beyaz.png")
);
render(svg({ size: 512, background: INK }), path.join(LOGO_DIR, "logo-renkli.png"));

console.log("Tamamlandı.");

import Svg, { G, Path, Rect, Text as SvgText } from "react-native-svg";

import { APP_NAME } from "../../config/brand";
import { fontFamily } from "../../theme/typography";
import { LOGO_VARIANTS, NOODLES, STICKS, WORDMARK, shineWidth } from "./brandData";

// Uygulama ikonu ve marka işareti: erişte telleri, "erişte" yazısı ve
// yemek çubukları. scripts/generate-brand-assets.mjs aynı çizimi PNG'ye
// çevirir; burada değişen bir şey orada da değişmeli.
export function BrandLogo({ size = 64, variant = "gece", radius }) {
  const v = LOGO_VARIANTS[variant] ?? LOGO_VARIANTS.gece;
  // radius ekran pikseli cinsinden; 512'lik viewBox'a çevrilir.
  const r = ((radius ?? size * 0.2237) / size) * 512;

  const wordmark = {
    x: WORDMARK.x,
    y: WORDMARK.y,
    textAnchor: "middle",
    fontFamily: fontFamily.extraBold,
    fontSize: WORDMARK.fontSize,
    textLength: WORDMARK.width,
    lengthAdjust: "spacingAndGlyphs",
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 512 512">
      <Rect width={512} height={512} rx={r} fill={v.bg} />

      {NOODLES.map(([d, w]) => (
        <Path
          key={d}
          d={d}
          stroke={v.noodle}
          strokeWidth={w}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ))}
      <G transform="translate(-2 -2)" opacity={0.75}>
        {NOODLES.map(([d, w]) => (
          <Path
            key={d}
            d={d}
            stroke={v.shine}
            strokeWidth={shineWidth(w)}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ))}
      </G>

      {/* paint-order desteklenmediği için önce zemin renginde kontur, sonra dolgu. */}
      <SvgText
        {...wordmark}
        fill={v.bg}
        stroke={v.bg}
        strokeWidth={WORDMARK.haloWidth}
        strokeLinejoin="round"
      >
        {APP_NAME}
      </SvgText>
      <SvgText {...wordmark} fill={v.text}>
        {APP_NAME}
      </SvgText>

      {STICKS.map((d) => (
        <Path key={`halo-${d}`} d={d} stroke={v.bg} strokeWidth={30} strokeLinecap="round" fill="none" />
      ))}
      {STICKS.map((d) => (
        <Path key={d} d={d} stroke={v.stick} strokeWidth={14} strokeLinecap="round" fill="none" />
      ))}
    </Svg>
  );
}

import Svg, { Path, Rect } from "react-native-svg";

import { NOODLE_PATH, SQUARES } from "./brandPaths";

// Karo logo: zemin renkli, kategori/marka bağlamında kullanılır.
export function BrandIcon({ size = 44 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512">
      <Rect width="512" height="512" rx="114" fill="#15131A" />
      <Path
        d={NOODLE_PATH}
        stroke="#FFC53D"
        strokeWidth={28}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {SQUARES.map((sq) => (
        <Rect
          key={`${sq.x}-${sq.y}`}
          x={-26}
          y={-26}
          width={52}
          height={52}
          rx={15}
          fill={sq.fill}
          transform={`translate(${sq.x} ${sq.y}) rotate(${sq.rotate})`}
        />
      ))}
    </Svg>
  );
}

// Tek renkli kullanım: zemin yok, işaret tek `color` ile çizilir (örn. koyu
// zemin üstünde beyaz, ya da herhangi bir yüzeyde ink). PNG ihtiyacı için
// aynı işaret assets/logo/ altında isaret-siyah.png ve isaret-kare-beyaz.png
// olarak da üretildi (bkz. scripts/generate-icons.js).
export function LogoMark({ size = 44, color = "#15131A" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512">
      <Path
        d={NOODLE_PATH}
        stroke={color}
        strokeWidth={28}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {SQUARES.map((sq) => (
        <Rect
          key={`${sq.x}-${sq.y}`}
          x={-26}
          y={-26}
          width={52}
          height={52}
          rx={15}
          fill={color}
          transform={`translate(${sq.x} ${sq.y}) rotate(${sq.rotate})`}
        />
      ))}
    </Svg>
  );
}

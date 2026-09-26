import Svg, { Path, Rect } from "react-native-svg";

const NOODLE_PATH =
  "M 54.0 318.0 C 56.0 314.2 62.0 300.7 66.0 295.4 C 70.0 290.0 74.0 286.0 78.0 286.0 C 82.0 286.0 86.0 290.0 90.0 295.4 C 94.0 300.7 98.0 310.5 102.0 318.0 C 106.0 325.5 110.0 335.3 114.0 340.6 C 118.0 346.0 122.0 350.0 126.0 350.0 C 130.0 350.0 134.0 346.0 138.0 340.6 C 142.0 335.3 146.0 325.5 150.0 318.0 C 154.0 310.5 158.0 300.7 162.0 295.4 C 166.0 290.0 170.0 286.0 174.0 286.0 C 178.0 286.0 182.0 290.0 186.0 295.4 C 190.0 300.7 194.0 310.5 198.0 318.0 C 202.0 325.5 206.0 335.3 210.0 340.6 C 214.0 346.0 218.0 350.0 222.0 350.0 C 226.0 350.0 230.0 346.0 234.0 340.6 C 238.0 335.3 242.0 325.5 246.0 318.0 C 250.0 310.5 254.0 300.7 258.0 295.4 C 262.0 290.0 268.0 287.6 270.0 286.0";

const SQUARES = [
  { x: 331.1, y: 278, rotate: -16.5 },
  { x: 391.4, y: 243.5, rotate: -43.8 },
  { x: 429.5, y: 187.7, rotate: -65.8 },
];

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
      <Rect
        x={-26}
        y={-26}
        width={52}
        height={52}
        rx={15}
        fill="#FFC53D"
        transform={`translate(${SQUARES[0].x} ${SQUARES[0].y}) rotate(${SQUARES[0].rotate})`}
      />
      <Rect
        x={-26}
        y={-26}
        width={52}
        height={52}
        rx={15}
        fill="#FF8A3D"
        transform={`translate(${SQUARES[1].x} ${SQUARES[1].y}) rotate(${SQUARES[1].rotate})`}
      />
      <Rect
        x={-26}
        y={-26}
        width={52}
        height={52}
        rx={15}
        fill="#FF5E57"
        transform={`translate(${SQUARES[2].x} ${SQUARES[2].y}) rotate(${SQUARES[2].rotate})`}
      />
    </Svg>
  );
}

// Tek renkli kullanım: zemin yok, işaret tek `color` ile çizilir (örn. koyu
// zemin üstünde beyaz, ya da herhangi bir yüzeyde ink). isaret-siyah.png
// henüz repoda olmadığı için PNG yerine SVG olarak üretildi; Aşama 5'te asıl
// ikon/splash PNG'leri üretilirken bu path'ler yeniden kullanılabilir.
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

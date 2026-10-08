import { useWindowDimensions } from "react-native";
import Svg, { G, Path } from "react-native-svg";

import { brandColors } from "../../theme/colors";
import { NOODLES } from "./brandData";

const PATTERN_SIZE = 512;

// Ekranın arkasında dolaşan erişte telleri. 512x512'lik desen tileSize
// boyutuna ölçeklenip yatayda ve dikeyde döşenir; dokunmaları engellemez.
export function NoodleBackground({
  width,
  height,
  color = brandColors.safran,
  opacity = 1,
  tileSize = 380,
  strokeScale = 1.4,
  style,
}) {
  const window = useWindowDimensions();
  const w = width ?? window.width;
  const h = height ?? window.height;
  const scale = tileSize / PATTERN_SIZE;
  const cols = Math.ceil(w / tileSize);
  const rows = Math.ceil(h / tileSize);

  const tiles = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      tiles.push(
        <G
          key={`${row}-${col}`}
          transform={`translate(${col * tileSize} ${row * tileSize}) scale(${scale})`}
        >
          {NOODLES.map(([d, strokeWidth]) => (
            <Path
              key={d}
              d={d}
              stroke={color}
              strokeWidth={strokeWidth * strokeScale}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
        </G>
      );
    }
  }

  return (
    <Svg
      width={w}
      height={h}
      pointerEvents="none"
      style={[{ position: "absolute", top: 0, left: 0, opacity }, style]}
    >
      {tiles}
    </Svg>
  );
}

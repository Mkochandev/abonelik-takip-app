import Svg, { Circle, Ellipse, Path } from "react-native-svg";

const SAFRAN = "#FFC53D";
const SAFRAN_KOYU = "#E9A321";
const INK = "#15131A";
const MANDALINA = "#FF8A3D";

const BOWLS = {
  krem: { body: "#F5F3F7", rim: "#DCD9E0", band: "#C8312A" },
  gece: { body: "#15131A", rim: "#2A2733", band: "#FFC53D" },
};

// react-native-svg'de Path'in varsayılan dolgusu siyah; çizgiler için kapatılır.
function Line({ d, color, width }) {
  return <Path d={d} stroke={color} strokeWidth={width} strokeLinecap="round" fill="none" />;
}

// Maskot Kıvırık: kâsenin içinden çıkan erişte teli.
// mood: selam | mutlu | sasirmis | heyecanli (iki kol havada, gülen), bowl: krem | gece
export function Kivirik({ size = 240, mood = "selam", bowl = "krem" }) {
  const b = BOWLS[bowl] ?? BOWLS.krem;

  return (
    <Svg width={size} height={(size * 230) / 240} viewBox="0 0 240 230">
      <Line d="M120 54 C110 36 126 20 140 28 C152 35 145 51 133 47" color={SAFRAN} width={11} />

      {mood === "selam" ? (
        <Line d="M178 104 C192 96 200 82 196 68" color={SAFRAN} width={12} />
      ) : null}
      {mood === "sasirmis" || mood === "heyecanli" ? (
        <>
          <Line d="M62 108 C46 96 42 78 50 64" color={SAFRAN} width={12} />
          <Line d="M178 108 C194 96 198 78 190 64" color={SAFRAN} width={12} />
        </>
      ) : null}

      <Ellipse cx={120} cy={104} rx={64} ry={56} fill={SAFRAN} />
      <Line d="M74 86 C84 79 94 92 104 85" color={SAFRAN_KOYU} width={5} />
      <Line d="M136 76 C146 69 156 82 166 75" color={SAFRAN_KOYU} width={5} />

      {mood === "selam" || mood === "heyecanli" ? (
        <>
          <Circle cx={100} cy={106} r={9.5} fill={INK} />
          <Circle cx={103.5} cy={102.5} r={3.2} fill="#FFFFFF" />
          <Circle cx={140} cy={106} r={9.5} fill={INK} />
          <Circle cx={143.5} cy={102.5} r={3.2} fill="#FFFFFF" />
        </>
      ) : null}
      {mood === "mutlu" ? (
        <>
          <Line d="M90 108 Q100 96 110 108" color={INK} width={5.5} />
          <Line d="M130 108 Q140 96 150 108" color={INK} width={5.5} />
        </>
      ) : null}
      {mood === "sasirmis" ? (
        <>
          <Circle cx={100} cy={104} r={12} fill="#FFFFFF" />
          <Circle cx={100} cy={105} r={6.5} fill={INK} />
          <Circle cx={140} cy={104} r={12} fill="#FFFFFF" />
          <Circle cx={140} cy={105} r={6.5} fill={INK} />
        </>
      ) : null}

      <Ellipse cx={85} cy={124} rx={9} ry={5.5} fill={MANDALINA} opacity={0.6} />
      <Ellipse cx={155} cy={124} rx={9} ry={5.5} fill={MANDALINA} opacity={0.6} />

      {mood === "sasirmis" ? (
        <Ellipse cx={120} cy={128} rx={7} ry={9} fill={INK} />
      ) : (
        <Line d="M108 122 Q120 135 132 122" color={INK} width={5} />
      )}

      <Path d="M26 144 H214 C214 194 172 222 120 222 C68 222 26 194 26 144 Z" fill={b.body} />
      <Ellipse cx={120} cy={144} rx={94} ry={11} fill={b.rim} />
      <Line d="M62 146 C66 158 56 164 61 176" color={SAFRAN} width={9} />
      <Line d="M176 146 C172 156 182 162 178 172" color={SAFRAN} width={9} />
      <Line
        d="M74 186 C88 176 102 196 116 186 C130 176 144 196 158 186 C162 183 166 183 168 185"
        color={b.band}
        width={6}
      />
    </Svg>
  );
}

// Küçük kafa: konuşma balonlarının yanında ve ana sayfa başlığında.
// mood: normal | dusunceli | sasirmis (zam kartı)
export function KivirikHead({ size = 48, mood = "normal" }) {
  const thinking = mood === "dusunceli";
  const surprised = mood === "sasirmis";
  const shineDx = thinking ? 0 : 2.5;
  const shineCy = thinking ? 61 : 63.5;

  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Line d="M58 22 C52 10 64 0 74 6 C82 11 77 22 68 19" color={SAFRAN} width={8} />
      <Ellipse cx={60} cy={66} rx={50} ry={44} fill={SAFRAN} />
      <Line d="M24 52 C32 46 40 56 48 50" color={SAFRAN_KOYU} width={4} />
      {surprised ? (
        <>
          <Circle cx={44} cy={64} r={10} fill="#FFFFFF" />
          <Circle cx={44} cy={65} r={5.5} fill={INK} />
          <Circle cx={76} cy={64} r={10} fill="#FFFFFF" />
          <Circle cx={76} cy={65} r={5.5} fill={INK} />
        </>
      ) : (
        <>
          <Circle cx={44} cy={66} r={7.5} fill={INK} />
          <Circle cx={44 + shineDx} cy={shineCy} r={2.5} fill="#FFFFFF" />
          <Circle cx={76} cy={66} r={7.5} fill={INK} />
          <Circle cx={76 + shineDx} cy={shineCy} r={2.5} fill="#FFFFFF" />
        </>
      )}
      <Ellipse cx={32} cy={80} rx={7} ry={4.5} fill={MANDALINA} opacity={0.6} />
      <Ellipse cx={88} cy={80} rx={7} ry={4.5} fill={MANDALINA} opacity={0.6} />
      {surprised ? (
        <Ellipse cx={60} cy={86} rx={5.5} ry={7} fill={INK} />
      ) : thinking ? (
        <Line d="M53 82 H67" color={INK} width={4} />
      ) : (
        <Line d="M52 80 Q60 88 68 80" color={INK} width={4} />
      )}
    </Svg>
  );
}

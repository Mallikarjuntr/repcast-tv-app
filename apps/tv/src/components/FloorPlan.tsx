import Svg, { Circle, Ellipse, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { colors, fonts } from '../theme';

const GRID = Array.from({ length: 15 }, (_, i) => (i + 1) * 40);

/** Top-down plan of the room: TV on the wall, you on the mat, the phone propped at 45°, about 2.5 m away. */
export function FloorPlan({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 640 518" accessibilityLabel="Floor plan: phone on the floor about two and a half metres from you, at 45 degrees, at hip height">
      <G stroke={colors.text} strokeOpacity={0.08} strokeWidth={1}>
        {GRID.map((v) => (
          <Path key={`h${v}`} d={`M0 ${v} H640`} />
        ))}
        {GRID.map((v) => (
          <Path key={`v${v}`} d={`M${v} 0 V518`} />
        ))}
      </G>
      <Path d="M30 34 H610" stroke={colors.text} strokeWidth={6} />
      <Rect x={200} y={38} width={200} height={16} fill={colors.text} />
      <SvgText x={300} y={80} textAnchor="middle" fontFamily={fonts.sansSemi} fontSize={14} letterSpacing={2} fill={colors.text}>
        TV ON THE WALL
      </SvgText>

      <Rect x={236} y={226} width={128} height={200} rx={6} fill="none" stroke={colors.text} strokeWidth={2} strokeDasharray="7 6" />
      <Ellipse cx={300} cy={320} rx={40} ry={18} fill={colors.text} />
      <Circle cx={300} cy={320} r={14} fill={colors.surface} stroke={colors.text} strokeWidth={3} />
      <Path d="M300 300 V 268 M292 276 L300 266 L308 276" fill="none" stroke={colors.text} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

      <Path d="M110 300 V 100 M102 100 H118 M102 300 H118" stroke={colors.text} strokeWidth={1.5} />
      <SvgText x={96} y={206} textAnchor="end" fontFamily={fonts.sansSemi} fontSize={15} fill={colors.text}>
        ≈ 2.5 m
      </SvgText>

      <G transform="translate(486 448) rotate(-45)">
        <Rect x={-14} y={-24} width={28} height={48} rx={5} fill={colors.text} />
        <Circle cx={0} cy={-15} r={4} fill={colors.accent} />
      </G>
      <Path d="M472 432 L 330 336" stroke={colors.accent} strokeWidth={2} strokeDasharray="5 6" />
      <Path d="M430 448 A 60 60 0 0 1 444 404" fill="none" stroke={colors.accent} strokeWidth={2} />
      <SvgText x={404} y={436} fontFamily={fonts.sansSemi} fontSize={14} fill={colors.accent}>
        45°
      </SvgText>
      <SvgText x={366} y={354} fontFamily={fonts.sansSemi} fontSize={14} fill={colors.accent} transform="rotate(34 366 354)">
        ≈ 2.5 m
      </SvgText>

      <SvgText x={440} y={300} fontFamily={fonts.sansBold} fontSize={24} fill={colors.accent}>
        prop me up at
      </SvgText>
      <SvgText x={440} y={328} fontFamily={fonts.sansBold} fontSize={24} fill={colors.accent}>
        hip height
      </SvgText>
      <Path d="M500 338 C 512 370, 506 396, 494 418 M494 418 L 490 404 M494 418 L 506 410" fill="none" stroke={colors.accent} strokeWidth={2.2} strokeLinecap="round" />

      <SvgText x={60} y={400} fontFamily={fonts.sansBold} fontSize={24} fill={colors.accent}>
        you, facing
      </SvgText>
      <SvgText x={60} y={428} fontFamily={fonts.sansBold} fontSize={24} fill={colors.accent}>
        the TV
      </SvgText>
      <Path d="M168 404 C 200 392, 226 360, 262 330 M262 330 L 248 333 M262 330 L 258 344" fill="none" stroke={colors.accent} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

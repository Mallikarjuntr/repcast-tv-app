import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { colors, fonts } from '../theme';

const W = 1008;
const H = 742;
const CHECKS: [string, string][] = [
  ['Head to feet', 'all in the picture'],
  ['Phone at hip height', 'leaning on a chair or shelf'],
  ['A little to one side', 'about 3 big steps away'],
];

/** A standing person, facing you: feet at (x, y), `h` tall. */
function Person({ x, y, h }: { x: number; y: number; h: number }) {
  const head = h * 0.08, neck = y - h * 0.79, hip = y - h * 0.45, tw = h * 0.2, leg = h * 0.085, arm = h * 0.06;
  const limb = (x1: number, y1: number, x2: number, y2: number, w: number) => (
    <Path d={`M${x1} ${y1} L${x2} ${y2}`} stroke={colors.text} strokeWidth={w} strokeLinecap="round" />
  );
  return (
    <G>
      <Circle cx={x} cy={neck - head * 1.35} r={head} fill={colors.text} />
      <Rect x={x - tw / 2} y={neck} width={tw} height={hip - neck + leg * 0.3} rx={tw * 0.3} fill={colors.text} />
      {limb(x - tw / 2 - arm * 0.15, neck + arm * 0.6, x - tw / 2 - h * 0.07, hip + h * 0.02, arm)}
      {limb(x + tw / 2 + arm * 0.15, neck + arm * 0.6, x + tw / 2 + h * 0.07, hip + h * 0.02, arm)}
      {limb(x - tw * 0.26, hip, x - tw * 0.34, y - leg / 2, leg)}
      {limb(x + tw * 0.26, hip, x + tw * 0.34, y - leg / 2, leg)}
    </G>
  );
}

/**
 * How to set the phone down, in the words people use: a phone showing what it should see (you,
 * head to feet) and three checks. Replaced a top-down floor plan that read as too technical.
 */
export function SetupGuide({ width, height }: { width: number; height: number }) {
  if (!width || !height) return null;
  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${W} ${H}`}
      accessibilityLabel="What your phone should see: you from head to feet. Phone at hip height, leaning on a chair or shelf, a little to one side, about three big steps away."
    >
      <G transform="translate(110 70)">
        <Rect width={330} height={600} rx={44} fill={colors.text} />
        <Rect x={18} y={40} width={294} height={520} rx={12} fill="#2F2A25" />
        <Circle cx={165} cy={22} r={6} fill={colors.accent} />
        <Rect x={30} y={52} width={270} height={496} rx={6} fill="none" stroke={colors.good} strokeWidth={4} strokeDasharray="12 10" />
        <Person x={165} y={520} h={430} />
      </G>
      <SvgText x={540} y={120} fontFamily={fonts.sansSemi} fontSize={30} fill={colors.accent}>
        This is what your phone should see
      </SvgText>
      {CHECKS.map(([title, detail], i) => {
        const y = 220 + i * 150;
        return (
          <G key={title}>
            <Circle cx={540} cy={y - 12} r={20} fill={colors.good} />
            <Path d={`M531 ${y - 12} l6 7 l12 -14`} stroke={colors.bg} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <SvgText x={580} y={y} fontFamily={fonts.display} fontSize={40} fill={colors.text}>
              {title}
            </SvgText>
            <SvgText x={580} y={y + 40} fontFamily={fonts.sansSemi} fontSize={28} fill={colors.textSoft}>
              {detail}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

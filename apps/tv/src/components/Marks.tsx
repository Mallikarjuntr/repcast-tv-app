import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../theme';

interface MarkProps {
  size: number;
  color?: string;
}

/** A hand-drawn tick. */
export function Tick({ size, color = colors.ink }: MarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 34 34">
      <Path d="M7 18 L 14 25 L 28 8" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** A short dash for a day with no session. */
export function Dash({ size, color = colors.faint }: MarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 34 34">
      <Path d="M10 17 L 24 17" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

/** A red-pen loop drawn around today. */
export function PenCircle({ size, color = colors.pen }: MarkProps) {
  return (
    <Svg width={size * 1.1} height={size} viewBox="0 0 38 34">
      <Path
        d="M19 3 C 31 2, 36 10, 35 18 C 34 28, 24 32, 16 31 C 7 30, 2 23, 3 15 C 4 7, 12 3, 22 4"
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** The red underline swash under the wordmark. */
export function Swash({ width, color = colors.pen }: { width: number; color?: string }) {
  return (
    <Svg width={width} height={width / 10} viewBox="0 0 118 12">
      <Path d="M2 8 C 30 3, 70 2, 116 6" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}

/** A curved hand-drawn arrow pointing up-left, used beside coach notes. */
export function PenArrow({ size, color = colors.pen }: MarkProps) {
  return (
    <Svg width={size} height={(size * 40) / 46} viewBox="0 0 46 40">
      <Path
        d="M40 36 C 30 30, 18 22, 10 6 M10 6 L 6 18 M10 6 L 21 12"
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Set progress dots: done (filled), current (highlighted ring) and upcoming (empty ring). */
export function SetDot({ size, state }: { size: number; state: 'done' | 'current' | 'upcoming' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26">
      <Circle
        cx={13}
        cy={13}
        r={10}
        fill={state === 'done' ? colors.ink : state === 'current' ? colors.highlighter : 'none'}
        stroke={colors.ink}
        strokeWidth={state === 'done' ? 0 : 2.5}
      />
    </Svg>
  );
}

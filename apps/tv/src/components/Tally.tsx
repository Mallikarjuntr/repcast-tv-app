import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme';

// Slight wobble so the strokes look hand-drawn rather than ruled.
const WOBBLE = [0.6, -0.5, 0.4, -0.7, 0.5];

/** Tally marks in groups of five (four strokes and a slash): `done` in ink, the rest faint. */
export function Tally({ done, total, height }: { done: number; total: number; height: number }) {
  const step = 16;
  const groupGap = 22;
  const groups = Math.ceil(total / 5);
  const width = groups * (4 * step + groupGap);
  const strokes: { d: string; done: boolean }[] = [];
  for (let i = 0; i < total; i++) {
    const group = Math.floor(i / 5);
    const pos = i % 5;
    const x0 = group * (4 * step + groupGap);
    const w = WOBBLE[i % WOBBLE.length]!;
    const d =
      pos < 4
        ? `M${x0 + pos * step + 4 + w} 6 L ${x0 + pos * step + 4 - w} 46`
        : `M${x0 - 4} 40 L ${x0 + 3 * step + 12} 10`;
    strokes.push({ d, done: i < done });
  }
  return (
    <Svg width={(width * height) / 52} height={height} viewBox={`-6 0 ${width + 6} 52`}>
      {strokes.map((s, i) => (
        <Path key={i} d={s.d} stroke={s.done ? colors.ink : colors.paperDeep} strokeWidth={4} strokeLinecap="round" fill="none" />
      ))}
    </Svg>
  );
}

import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme';

interface MarkProps {
  size: number;
  color?: string;
}

/** A tick, for something done or seen. */
export function Tick({ size, color = colors.good }: MarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 34 34">
      <Path d="M7 18 L 14 25 L 28 8" fill="none" stroke={color} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** A cross, for something missing. */
export function Cross({ size, color = colors.fault }: MarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 34 34">
      <Path d="M9 9 L 25 25 M 25 9 L 9 25" fill="none" stroke={color} strokeWidth={3.5} strokeLinecap="round" />
    </Svg>
  );
}

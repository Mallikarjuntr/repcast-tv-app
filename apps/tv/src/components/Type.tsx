import type { ReactNode } from 'react';
import { Text, View, type TextStyle } from 'react-native';
import { colors, fonts, useScale } from '../theme';
import { PenArrow, Swash } from './Marks';

/** Small monospaced caps label, e.g. "TODAY'S SESSION — 18 MIN". */
export function Kicker({ children, color = colors.pencil, size = 16 }: { children: ReactNode; color?: string; size?: number }) {
  const s = useScale();
  return <Text style={{ fontFamily: fonts.mono, fontSize: s(size), letterSpacing: s(size * 0.12), color }}>{children}</Text>;
}

/** The spotter wordmark with its red-pen swash. */
export function Wordmark({ size = 36 }: { size?: number }) {
  const s = useScale();
  return (
    <View>
      <Text style={{ fontFamily: fonts.displayBoldItalic, fontSize: s(size), color: colors.ink, lineHeight: s(size * 1.1) }}>spotter</Text>
      <Swash width={s(size * 3.3)} />
    </View>
  );
}

/** Big serif headline with an optional italic second line. */
export function Headline({ lead, italic, size }: { lead: string; italic?: string; size: number }) {
  const s = useScale();
  const base: TextStyle = { fontSize: s(size), lineHeight: s(size * 0.98), color: colors.ink, letterSpacing: -s(size * 0.02) };
  return (
    <Text style={[base, { fontFamily: fonts.display }]}>
      {lead}
      {italic ? <Text style={{ fontFamily: fonts.displayItalic }}>{italic}</Text> : null}
    </Text>
  );
}

/** The coach's handwritten note in red pen, slightly tilted, with an arrow. */
export function PenNote({ children, size = 28, tilt = -2.5, arrow = true }: { children: ReactNode; size?: number; tilt?: number; arrow?: boolean }) {
  const s = useScale();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: s(6), transform: [{ rotate: `${tilt}deg` }] }}>
      {arrow ? <PenArrow size={s(46)} /> : null}
      <Text style={{ fontFamily: fonts.hand, fontSize: s(size), lineHeight: s(size * 1.2), color: colors.pen }}>{children}</Text>
    </View>
  );
}

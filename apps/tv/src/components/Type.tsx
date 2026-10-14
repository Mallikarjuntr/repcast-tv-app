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

/** Big serif headline with an optional italic part; `\n` starts a new line. */
export function Headline({ lead, italic, size }: { lead: string; italic?: string; size: number }) {
  const s = useScale();
  // Android clips glyphs to a text box shorter than the font, which cuts off descenders (g, y, p)
  // at tight leading. So each line is its own Text with roomy line height, and the lines are
  // overlapped back to the tight 0.98 leading with negative margins.
  const roomy = size * 1.3;
  const pull = s(roomy - size * 0.98);
  const segments = [
    ...lead.split('\n').map((text, i) => ({ text, italic: false, newLine: i > 0 })),
    ...(italic ?? '').split('\n').map((text, i) => ({ text, italic: true, newLine: i > 0 })),
  ];
  const lines: { text: string; italic: boolean }[][] = [[]];
  for (const segment of segments) {
    if (segment.newLine) lines.push([]);
    if (segment.text) lines[lines.length - 1]!.push(segment);
  }
  const base: TextStyle = { fontSize: s(size), lineHeight: s(roomy), color: colors.ink, letterSpacing: -s(size * 0.02) };
  return (
    // Trim the roomy line's extra space above the first line; below, it leaves room for descenders.
    <View style={{ marginTop: -pull / 2 }}>
      {lines
        .filter((line) => line.length > 0)
        .map((line, i) => (
          <Text key={i} style={[base, { fontFamily: fonts.display, marginTop: i > 0 ? -pull : 0 }]}>
            {line.map((part, j) => (
              <Text key={j} style={part.italic ? { fontFamily: fonts.displayItalic } : undefined}>
                {part.text}
              </Text>
            ))}
          </Text>
        ))}
    </View>
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

import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { colors, fonts, useScale } from '../theme';

/** Small spaced caps label, e.g. "TODAY · 9 MIN · CAMERA COACHED". */
export function Kicker({ children, color = colors.muted, size = 15 }: { children: ReactNode; color?: string; size?: number }) {
  const s = useScale();
  return <Text style={{ fontFamily: fonts.sansBold, fontSize: s(size), letterSpacing: s(size * 0.18), color }}>{children}</Text>;
}

/** The spotter wordmark: lower-case, with an orange full stop. */
export function Wordmark({ size = 30 }: { size?: number }) {
  const s = useScale();
  return (
    <Text style={{ fontFamily: fonts.sansHeavy, fontSize: s(size), letterSpacing: -s(size * 0.015), color: colors.text }}>
      spotter<Text style={{ color: colors.accent }}>.</Text>
    </Text>
  );
}

/**
 * Tight condensed text, one Text per line. Android clips glyphs to a text box shorter than the
 * font, so each line gets a roomy line height and the lines are pulled back together with
 * negative margins to `leading` × size.
 */
function TightLines({ lines, size, leading, color, font, letterSpacing = 0 }: { lines: string[]; size: number; leading: number; color: string; font: string; letterSpacing?: number }) {
  const s = useScale();
  const roomy = size * 1.25;
  const pull = s(roomy - size * leading);
  return (
    <View style={{ marginTop: -pull / 2, marginBottom: -pull / 2 }}>
      {lines.map((line, i) => (
        <Text key={i} style={{ fontFamily: font, fontSize: s(size), lineHeight: s(roomy), letterSpacing: s(letterSpacing), color, marginTop: i > 0 ? -pull : 0 }}>
          {line}
        </Text>
      ))}
    </View>
  );
}

/** Big condensed upper-case headline; `\n` starts a new line. */
export function Headline({ text, size, color = colors.text }: { text: string; size: number; color?: string }) {
  const lines = text.toUpperCase().split('\n').map((l) => l.trim()).filter(Boolean);
  return <TightLines lines={lines} size={size} leading={0.9} color={color} font={fonts.display} />;
}

/** A huge count ("08") with an optional smaller suffix ("/ 12", "seconds") on its baseline. */
export function BigNumber({ value, suffix, size, color = colors.text }: { value: string; suffix?: string; size: number; color?: string }) {
  const s = useScale();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: s(size * 0.05) }}>
      <TightLines lines={[value]} size={size} leading={0.8} color={color} font={fonts.display} letterSpacing={-size * 0.02} />
      {suffix ? (
        <Text style={{ fontFamily: fonts.displaySemi, fontSize: s(size * 0.19), color: colors.faint, marginBottom: s(size * 0.04) }}>{suffix}</Text>
      ) : null}
    </View>
  );
}

/** Plain supporting text in the softer cream. */
export function Note({ children, size = 20, color = colors.textSoft }: { children: ReactNode; size?: number; color?: string }) {
  const s = useScale();
  return <Text style={{ fontFamily: fonts.sans, fontSize: s(size), lineHeight: s(size * 1.45), color }}>{children}</Text>;
}

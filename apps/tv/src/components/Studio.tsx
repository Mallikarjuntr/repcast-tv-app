import type { ReactNode } from 'react';
import { Text, View, type ViewStyle } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import type { DayState } from '../storage';
import { colors, fonts, useScale } from '../theme';
import { Headline, Kicker, Note } from './Type';

/** A dark rounded panel. */
export function Card({ children, style }: { children?: ReactNode; style?: ViewStyle }) {
  const s = useScale();
  return <View style={[{ backgroundColor: colors.surface, borderRadius: s(18), padding: s(22) }, style]}>{children}</View>;
}

/** A dark label chip laid over a video or trainer panel ("LIKE THIS", "YOU · LIVE"). */
export function PanelTag({ children, dot, color = colors.textSoft }: { children: ReactNode; dot?: string; color?: string }) {
  const s = useScale();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), backgroundColor: colors.bg, borderRadius: s(8), paddingHorizontal: s(12), paddingVertical: s(7) }}>
      {dot ? <View style={{ width: s(9), height: s(9), borderRadius: s(5), backgroundColor: dot }} /> : null}
      <Kicker size={14} color={color}>
        {children}
      </Kicker>
    </View>
  );
}

/** One bar per rep: the done ones in the accent. Plain Views, so it's cheap to redraw per rep. */
export function Segments({ done, total, height = 10, gap = 5 }: { done: number; total: number; height?: number; gap?: number }) {
  const s = useScale();
  return (
    <View style={{ flexDirection: 'row', gap: s(gap) }}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={{ flex: 1, height: s(height), borderRadius: s(3), backgroundColor: i < done ? colors.accent : colors.line }} />
      ))}
    </View>
  );
}

/** A big number with a caps label under it, on a card. */
export function StatTile({ value, label, color = colors.text, size = 60, style }: { value: string; label: string; color?: string; size?: number; style?: ViewStyle }) {
  const s = useScale();
  return (
    <Card style={{ borderRadius: s(14), paddingVertical: s(16), paddingHorizontal: s(20), gap: s(8), ...style }}>
      <Headline text={value} size={size} color={color} />
      <Kicker size={13}>{label}</Kicker>
    </Card>
  );
}

/** Monday to Sunday as squares: trained (accent), today (ringed), missed, still to come. */
export function WeekStrip({ week, size = 34 }: { week: { day: string; state: DayState }[]; size?: number }) {
  const s = useScale();
  return (
    <View style={{ flexDirection: 'row', gap: s(size * 0.26) }}>
      {week.map(({ day, state }, i) => (
        <View key={i} style={{ alignItems: 'center', gap: s(6) }}>
          <View
            style={{
              width: s(size),
              height: s(size),
              borderRadius: s(size * 0.25),
              backgroundColor: state === 'done' ? colors.accent : state === 'missed' ? colors.line : 'transparent',
              borderWidth: state === 'today' ? s(3) : state === 'ahead' ? s(1) : 0,
              borderColor: state === 'today' ? colors.text : colors.line,
            }}
          />
          <Kicker size={12} color={state === 'today' ? colors.text : colors.faint}>
            {day.charAt(0)}
          </Kicker>
        </View>
      ))}
    </View>
  );
}

export function Lock({ size, color = colors.textSoft }: { size: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={5} y={11} width={14} height={10} rx={2} fill="none" stroke={color} strokeWidth={2} />
      <Path d="M8 11 V7 a4 4 0 0 1 8 0 V11" fill="none" stroke={color} strokeWidth={2} />
    </Svg>
  );
}

export function Speaker({ size, color = colors.accent }: { size: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 9 H8 L13 5 V19 L8 15 H4 Z" fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M16.5 8.5 C 18 10, 18 14, 16.5 15.5" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function Wifi({ size, color = colors.accent }: { size: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M2.5 9 C 8 4, 16 4, 21.5 9" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M5.5 12.5 C 9.5 9, 14.5 9, 18.5 12.5" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M8.5 16 C 10.5 14.3, 13.5 14.3, 15.5 16" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M12 19.5 L12 19.6" stroke={color} strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}

/**
 * Shown when the phone's live picture doesn't reach the TV, almost always because they're on
 * different networks (or Wi-Fi that keeps devices apart): the video only travels inside the home.
 */
export function NoVideoNotice({ compact = false }: { compact?: boolean }) {
  const s = useScale();
  return (
    <View style={{ flexDirection: 'row', gap: s(12), alignItems: 'flex-start', backgroundColor: colors.bg, borderRadius: s(12), paddingVertical: s(10), paddingHorizontal: s(14) }}>
      <View style={{ marginTop: s(2) }}>
        <Wifi size={s(compact ? 20 : 24)} />
      </View>
      <View style={{ flexShrink: 1, gap: s(2) }}>
        <Text style={{ fontFamily: fonts.sansBold, fontSize: s(compact ? 15 : 17), color: colors.text }}>No live picture from your phone</Text>
        <Text style={{ fontFamily: fonts.sans, fontSize: s(compact ? 13 : 15), lineHeight: s(compact ? 18 : 21), color: colors.textSoft }}>
          Put the phone and TV on the same Wi-Fi to see yourself here. Your reps still count.
        </Text>
      </View>
    </View>
  );
}

/** The privacy line, with a padlock. */
export function PrivacyLine({ color = colors.faint, size = 14 }: { color?: string; size?: number }) {
  const s = useScale();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
      <Lock size={s(size)} color={color} />
      <Text style={{ fontFamily: fonts.sans, fontSize: s(size), color }}>Video goes only from your phone to your TV — never to the cloud</Text>
    </View>
  );
}

/** What the coach just said, on a card. A correction is shown in the fault colour. */
export function CoachCard({ line, label = 'YOUR COACH', correction = false, size = 28 }: { line: string; label?: string; correction?: boolean; size?: number }) {
  const s = useScale();
  return (
    <Card style={{ flexDirection: 'row', gap: s(16), alignItems: 'flex-start', paddingVertical: s(18) }}>
      <View style={{ marginTop: s(3) }}>
        <Speaker size={s(30)} color={correction ? colors.fault : colors.accent} />
      </View>
      <View style={{ flex: 1, gap: s(6) }}>
        <Kicker size={13} color={correction ? colors.fault : colors.accent}>
          {label}
        </Kicker>
        <Text style={{ fontFamily: fonts.sansBold, fontSize: s(size), lineHeight: s(size * 1.2), color: colors.text }}>“{line.charAt(0).toUpperCase() + line.slice(1)}”</Text>
      </View>
    </Card>
  );
}

/** Covers a workout while it's paused. */
export function PausedOverlay() {
  const s = useScale();
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', gap: s(22) }}>
      <Headline text="Paused" size={150} />
      <Note size={22}>Press OK or play/pause to carry on</Note>
    </View>
  );
}

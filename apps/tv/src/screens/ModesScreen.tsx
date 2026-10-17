import { Pressable, Text, View } from 'react-native';
import { BackButton } from '../components/FocusButton';
import { Headline, Kicker } from '../components/Type';
import { colors, fonts, useScale } from '../theme';
import { isFocused } from '../tv';

export type Mode = 'core' | 'coach';

interface ModeCardProps {
  kicker: string;
  title: string;
  /** What this mode offers, e.g. "12 moves, every rep checked". */
  today?: string;
  points: string[];
  action: string;
  /** The camera mode, the one to try first: its points and kicker are in the accent. */
  highlight?: boolean;
  preferredFocus?: boolean;
  onPress: () => void;
}

/** The whole card is one button: focus rings it, and its action chip turns orange. */
function ModeCard({ kicker, title, today, points, action, highlight, preferredFocus, onPress }: ModeCardProps) {
  const s = useScale();
  return (
    <Pressable style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={`${title}. ${action}`} onPress={onPress} hasTVPreferredFocus={preferredFocus}>
      {(state) => {
        const focused = isFocused(state);
        return (
          <View style={{ flex: 1, borderRadius: s(24), borderWidth: s(3), borderColor: focused ? colors.text : 'transparent', padding: s(3), transform: [{ scale: focused ? 1.02 : 1 }] }}>
            <View style={{ flex: 1, borderRadius: s(18), backgroundColor: focused ? colors.surfaceHigh : colors.surface, paddingVertical: s(26), paddingHorizontal: s(30), gap: s(14) }}>
              <Kicker size={14} color={highlight ? colors.accent : colors.muted}>
                {kicker}
              </Kicker>
              <View style={{ gap: s(4) }}>
                <Text style={{ fontFamily: fonts.display, fontSize: s(46), color: colors.text }}>{title}</Text>
                {today ? <Text style={{ fontFamily: fonts.sansSemi, fontSize: s(17), color: highlight ? colors.accent : colors.muted }}>{today}</Text> : null}
              </View>
              <View style={{ gap: s(10) }}>
                {points.map((point) => (
                  <View key={point} style={{ flexDirection: 'row', alignItems: 'center', gap: s(12) }}>
                    <View style={{ width: s(8), height: s(8), borderRadius: s(4), backgroundColor: highlight ? colors.accent : colors.faint }} />
                    <Text style={{ fontFamily: fonts.sans, fontSize: s(19), color: highlight ? colors.text : colors.textSoft, flexShrink: 1 }}>{point}</Text>
                  </View>
                ))}
              </View>
              <View style={{ marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: s(18) }}>
                <View style={{ backgroundColor: focused ? colors.accent : colors.raised, borderRadius: s(12), paddingVertical: s(15), paddingHorizontal: s(26) }}>
                  <Text style={{ fontFamily: fonts.sansHeavy, fontSize: s(21), color: focused ? colors.onAccent : colors.text }}>{action}</Text>
                </View>
              </View>
            </View>
          </View>
        );
      }}
    </Pressable>
  );
}

export function ModesScreen({ coachToday, coreToday, onChoose, onBack }: { coachToday: string; coreToday: string; onChoose: (mode: Mode) => void; onBack: () => void }) {
  const s = useScale();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: s(44), paddingHorizontal: s(64), paddingBottom: s(36), gap: s(26) }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View style={{ gap: s(12) }}>
          <Kicker color={colors.accent}>START A SESSION</Kicker>
          <Headline text="How shall we train?" size={76} />
        </View>
        <BackButton onPress={onBack} />
      </View>

      <View style={{ flex: 1, flexDirection: 'row', gap: s(22), marginHorizontal: -s(6) }}>
        <ModeCard
          kicker="WITH YOUR PHONE'S CAMERA"
          title="Coach me on camera"
          today={coachToday}
          points={['Form checks on every single rep', 'Uses the phone or webcam you already own', 'Your live picture on the TV, skeleton drawn on', "A coach's note at the end"]}
          action="Pick a move"
          highlight
          preferredFocus
          onPress={() => onChoose('coach')}
        />
        <ModeCard
          kicker="NO CAMERA"
          title="Follow along"
          today={coreToday}
          points={['A 3D trainer shows every move', 'A voice and a tempo beat to follow', 'Reps counted for you, on the beat', 'Planks and wall sits too']}
          action="Pick a move"
          onPress={() => onChoose('core')}
        />
      </View>

      <Text style={{ fontFamily: fonts.sans, fontSize: s(14), color: colors.faint }}>Video goes only from your phone to your TV — never to the cloud</Text>
    </View>
  );
}

import { Pressable, Text, View } from 'react-native';
import { Headline, Kicker } from '../components/Type';
import { colors, fonts, useScale } from '../theme';
import { isFocused } from '../tv';

export type Mode = 'core' | 'coach';

interface ModeCardProps {
  kicker: string;
  title: string;
  points: string[];
  action: string;
  /** The paid mode's points and kicker are in the accent. */
  highlight?: boolean;
  badge?: string;
  price?: string;
  preferredFocus?: boolean;
  onPress: () => void;
}

/** The whole card is one button: focus rings it, and its action chip turns orange. */
function ModeCard({ kicker, title, points, action, highlight, badge, price, preferredFocus, onPress }: ModeCardProps) {
  const s = useScale();
  return (
    <Pressable style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={`${title}. ${action}`} onPress={onPress} hasTVPreferredFocus={preferredFocus}>
      {(state) => {
        const focused = isFocused(state);
        return (
          <View style={{ flex: 1, borderRadius: s(24), borderWidth: s(3), borderColor: focused ? colors.text : 'transparent', padding: s(3), transform: [{ scale: focused ? 1.02 : 1 }] }}>
            <View style={{ flex: 1, borderRadius: s(18), backgroundColor: focused ? colors.surfaceHigh : colors.surface, paddingVertical: s(26), paddingHorizontal: s(30), gap: s(14) }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: s(12) }}>
                <Kicker size={14} color={highlight ? colors.accent : colors.muted}>
                  {kicker}
                </Kicker>
                {badge ? (
                  <View style={{ backgroundColor: colors.bg, borderRadius: s(8), paddingHorizontal: s(12), paddingVertical: s(6) }}>
                    <Kicker size={13} color={colors.textSoft}>
                      {badge}
                    </Kicker>
                  </View>
                ) : null}
              </View>
              <Text style={{ fontFamily: fonts.display, fontSize: s(46), color: colors.text }}>{title}</Text>
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
                {price ? <Text style={{ fontFamily: fonts.sans, fontSize: s(15), lineHeight: s(21), color: colors.muted }}>{price}</Text> : null}
              </View>
            </View>
          </View>
        );
      }}
    </Pressable>
  );
}

export function ModesScreen({
  sessionLabel,
  onChoose,
  freeCoachSessionsLeft,
}: {
  sessionLabel: string;
  onChoose: (mode: Mode) => void;
  freeCoachSessionsLeft: number;
}) {
  const s = useScale();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: s(44), paddingHorizontal: s(64), paddingBottom: s(36), gap: s(26) }}>
      <View style={{ gap: s(12) }}>
        <Kicker color={colors.accent}>{sessionLabel}</Kicker>
        <Headline text="How shall we train?" size={76} />
      </View>

      <View style={{ flex: 1, flexDirection: 'row', gap: s(22), marginHorizontal: -s(6) }}>
        <ModeCard
          kicker="CORE · FREE · NO CAMERA"
          title="Follow along"
          points={['A voice that guides every move', 'Timers and a tempo beat to follow', 'Reps counted for you, on the beat', 'Streaks and progress, week by week']}
          action="Start following along"
          onPress={() => onChoose('core')}
        />
        <ModeCard
          kicker="SMART COACHING · PAID"
          title="Coach me on camera"
          points={['Form checks on every single rep', 'Uses the phone or webcam you already own', "Your coach's note after every session", 'Plans that adapt to how you moved']}
          action="Start coaching"
          highlight
          badge={freeCoachSessionsLeft > 0 ? `${freeCoachSessionsLeft} OF 3 FREE LEFT` : 'FREE SESSIONS USED THIS WEEK'}
          price={'then ₹149 / month\nor ₹999 / year'}
          preferredFocus
          onPress={() => onChoose('coach')}
        />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: fonts.sans, fontSize: s(14), color: colors.faint }}>Video goes only from your phone to your TV — never to the cloud</Text>
        <Text style={{ fontFamily: fonts.sans, fontSize: s(14), color: colors.faint }}>Manage your plan in your Amazon account</Text>
      </View>
    </View>
  );
}

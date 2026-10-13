import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Headline, Kicker } from '../components/Type';
import { colors, fonts, useScale } from '../theme';
import { isFocused } from '../tv';

export type Mode = 'core' | 'coach';

interface ModeCardProps {
  kicker: string;
  title: string;
  titleItalic?: string;
  points: string[];
  action: string;
  numberColor: string;
  badge?: string;
  price?: string;
  preferredFocus?: boolean;
  onPress: () => void;
}

function ModeCard({ kicker, title, titleItalic, points, action, numberColor, badge, price, preferredFocus, onPress }: ModeCardProps) {
  const s = useScale();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}${titleItalic ?? ''}. ${action}`}
      onPress={onPress}
      hasTVPreferredFocus={preferredFocus}
      style={(state) => {
        const focused = isFocused(state);
        return {
        flex: 1,
        backgroundColor: focused ? colors.paperBright : colors.paperDeep,
        borderColor: colors.ink,
        borderWidth: s(focused ? 3 : 1.5),
        paddingVertical: s(28),
        paddingHorizontal: s(32),
        gap: s(14),
        transform: [{ scale: focused ? 1.02 : 1 }],
        };
      }}
    >
      {(state) => {
        const focused = isFocused(state);
        return (
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Kicker size={15}>{kicker}</Kicker>
            {badge ? (
              <View style={{ backgroundColor: colors.highlighter, paddingHorizontal: s(8), paddingVertical: s(3) }}>
                <Kicker size={14} color={colors.ink}>{badge}</Kicker>
              </View>
            ) : null}
          </View>
          <Text style={{ fontFamily: fonts.display, fontSize: s(48), lineHeight: s(52), color: colors.ink }}>
            {title}
            {titleItalic ? <Text style={{ fontFamily: fonts.displayItalic }}>{titleItalic}</Text> : null}
          </Text>
          <View style={{ gap: s(8) }}>
            {points.map((point, i) => (
              <View key={point} style={{ flexDirection: 'row', gap: s(12) }}>
                <Text style={{ fontFamily: fonts.mono, fontSize: s(18), lineHeight: s(28), color: numberColor }}>{String(i + 1).padStart(2, '0')}</Text>
                <Text style={{ fontFamily: fonts.sans, fontSize: s(21), lineHeight: s(28), color: colors.ink, flexShrink: 1 }}>{point}</Text>
              </View>
            ))}
          </View>
          <View style={{ marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: s(22) }}>
            <View
              style={{
                backgroundColor: focused ? colors.highlighter : 'transparent',
                borderColor: colors.ink,
                borderWidth: s(2.5),
                borderRadius: s(3),
                paddingVertical: s(14),
                paddingHorizontal: s(26),
              }}
            >
              <Text style={{ fontFamily: fonts.sansBold, fontSize: s(22), color: colors.ink }}>{action}</Text>
            </View>
            {price ? (
              <Text style={{ fontFamily: fonts.mono, fontSize: s(15), lineHeight: s(22), color: colors.pencil }}>{price}</Text>
            ) : null}
          </View>
        </>
        );
      }}
    </Pressable>
  );
}

export function ModesScreen({ onChoose, freeCoachSessionsLeft }: { onChoose: (mode: Mode) => void; freeCoachSessionsLeft: number }) {
  const s = useScale();
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper, paddingTop: s(40), paddingHorizontal: s(64), paddingBottom: s(32), gap: s(22) }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View style={{ gap: s(10) }}>
          <Kicker>LEGS, GENTLY · 18 MIN</Kicker>
          <Headline lead="How shall we " italic="train today?" size={72} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: s(6), transform: [{ rotate: '-3deg' }] }}>
          <Text style={{ fontFamily: fonts.hand, fontSize: s(26), lineHeight: s(30), color: colors.pen, textAlign: 'right' }}>
            this one watches{'\n'}your form
          </Text>
          <Svg width={s(60)} height={s(56)} viewBox="0 0 60 56">
            <Path d="M4 8 C 28 6, 46 22, 50 50 M50 50 L 40 42 M50 50 L 55 38" fill="none" stroke={colors.pen} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
      </View>

      <View style={{ flex: 1, flexDirection: 'row', gap: s(32) }}>
        <ModeCard
          kicker="CORE · FREE · NO CAMERA"
          title="Follow along"
          points={['A voice that guides every move', 'Timers and a tempo beat to follow', 'Reps counted by the beat, or press OK', 'Streaks and progress, week by week']}
          action="Start following along"
          numberColor={colors.pencil}
          onPress={() => onChoose('core')}
        />
        <ModeCard
          kicker="SMART COACHING · SPOTTER COACH"
          title="Coach "
          titleItalic="me"
          points={['Form checks on every single rep', 'Uses the phone or webcam you already own', "Your coach's note after every session", 'Plans that adapt to how you moved']}
          action="Start coaching"
          numberColor={colors.pen}
          badge={`${freeCoachSessionsLeft} OF 3 FREE LEFT`}
          price={'THEN ₹149 / MONTH\nOR ₹999 / YEAR'}
          preferredFocus
          onPress={() => onChoose('coach')}
        />
      </View>

      <View style={{ flexDirection: 'row', gap: s(36) }}>
        <Kicker size={14}>VIDEO NEVER LEAVES YOUR DEVICE</Kicker>
        <Kicker size={14}>MANAGE YOUR PLAN IN YOUR AMAZON ACCOUNT</Kicker>
      </View>
    </View>
  );
}

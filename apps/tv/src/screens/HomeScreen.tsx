import { Text, View } from 'react-native';
import { Dash, PenCircle, Tick } from '../components/Marks';
import { FocusButton } from '../components/FocusButton';
import { Headline, Kicker, PenNote, Wordmark } from '../components/Type';
import { colors, fonts, useScale } from '../theme';

// Sample data until sessions come from the backend.
const TODAY = {
  minutes: 18,
  titleLead: 'Legs,\n',
  titleItalic: 'gently.',
  summary: "Squats, lunges and jumping jacks. You said your knees felt tight on Sunday, so we'll take a longer warm-up.",
  coachNote: "go slow on the way down —\nI'll do the counting.",
  session: 4,
};
const WEEK: { day: string; state: 'done' | 'missed' | 'today' }[] = [
  { day: 'M', state: 'done' },
  { day: 'T', state: 'done' },
  { day: 'W', state: 'missed' },
  { day: 'T', state: 'done' },
  { day: 'F', state: 'done' },
  { day: 'S', state: 'done' },
  { day: 'S', state: 'today' },
];
const LAST_TIME = { label: 'LAST TIME · SAT', lines: ['96 reps', '84% clean form', 'knees drifted on 2 reps'] };

function formatToday(date: Date): string {
  const day = date.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase();
  const dm = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase();
  return `${day} · ${dm}`;
}

export function HomeScreen({ onStart, onNoCamera }: { onStart: () => void; onNoCamera: () => void }) {
  const s = useScale();
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper, paddingTop: s(40), paddingHorizontal: s(64), paddingBottom: s(36), gap: s(28) }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Wordmark />
        <View style={{ alignItems: 'flex-end' }}>
          <Kicker>{formatToday(new Date())}</Kicker>
          <Kicker>SESSION {String(TODAY.session).padStart(2, '0')}</Kicker>
        </View>
      </View>

      <View style={{ flex: 1, flexDirection: 'row', gap: s(72) }}>
        <View style={{ flex: 1.55, gap: s(22) }}>
          <Kicker>TODAY'S SESSION — {TODAY.minutes} MIN</Kicker>
          <Headline lead={TODAY.titleLead} italic={TODAY.titleItalic} size={120} />
          <Text style={{ fontFamily: fonts.sans, fontSize: s(24), lineHeight: s(35), color: colors.inkSoft, maxWidth: s(600) }}>{TODAY.summary}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(28), marginTop: s(10) }}>
            <FocusButton label="Start session" onPress={onStart} preferredFocus />
            <FocusButton label="Swap a move" onPress={() => {}} variant="link" fontSize={22} />
            <FocusButton label="Move without camera" onPress={onNoCamera} variant="link" fontSize={22} />
          </View>
          <View style={{ marginLeft: s(40) }}>
            <PenNote>{TODAY.coachNote}</PenNote>
          </View>
        </View>

        <View style={{ flex: 1, gap: s(26), borderLeftWidth: s(1.5), borderLeftColor: colors.ink, paddingLeft: s(40) }}>
          <Kicker>THIS WEEK</Kicker>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {WEEK.map(({ day, state }, i) => (
              <View key={i} style={{ alignItems: 'center', gap: s(8) }}>
                <Kicker color={state === 'missed' ? colors.pencil : colors.ink}>{day}</Kicker>
                {state === 'done' ? <Tick size={s(34)} /> : state === 'missed' ? <Dash size={s(34)} /> : <PenCircle size={s(34)} />}
              </View>
            ))}
          </View>
          <Text style={{ fontFamily: fonts.displayItalic, fontSize: s(34), lineHeight: s(39), color: colors.ink }}>
            Five days this week.{'\n'}Today makes six.
          </Text>
          <View style={{ borderTopWidth: s(1.5), borderTopColor: colors.faint, paddingTop: s(22), gap: s(10) }}>
            <Kicker>{LAST_TIME.label}</Kicker>
            {LAST_TIME.lines.map((line) => (
              <Text key={line} style={{ fontFamily: fonts.mono, fontSize: s(20), lineHeight: s(32), color: colors.ink }}>
                {line}
              </Text>
            ))}
          </View>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: s(36) }}>
        <Kicker size={15}>◀ ▶  MOVE</Kicker>
        <Kicker size={15}>OK  SELECT</Kicker>
        <Kicker size={15}>PLAY/PAUSE  PAUSE ANYTIME</Kicker>
      </View>
    </View>
  );
}

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
type DayState = 'done' | 'missed' | 'today' | 'ahead';

// Sample history until sessions come from the backend: every earlier day done except Wednesday.
function weekSoFar(today: Date): { day: string; state: DayState }[] {
  const todayIndex = (today.getDay() + 6) % 7; // Monday = 0
  return ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => ({
    day,
    state: i === todayIndex ? 'today' : i > todayIndex ? 'ahead' : i === 2 ? 'missed' : 'done',
  }));
}

const NUMBER_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'];

function streakLine(done: number): string {
  if (done === 0) return 'A fresh week.\nToday makes one.';
  return `${NUMBER_WORDS[done]} ${done === 1 ? 'day' : 'days'} this week.\nToday makes ${NUMBER_WORDS[done + 1]!.toLowerCase()}.`;
}

const LAST_TIME = { label: 'LAST TIME · SAT', lines: ['96 reps', '84% clean form', 'knees drifted on 2 reps'] };

function formatToday(date: Date): string {
  const day = date.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase();
  const dm = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase();
  return `${day} · ${dm}`;
}

export function HomeScreen({ onStart, onNoCamera }: { onStart: () => void; onNoCamera: () => void }) {
  const s = useScale();
  const now = new Date();
  const week = weekSoFar(now);
  const done = week.filter((d) => d.state === 'done').length;
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper, paddingTop: s(40), paddingHorizontal: s(64), paddingBottom: s(36), gap: s(28) }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Wordmark />
        <View style={{ alignItems: 'flex-end' }}>
          <Kicker>{formatToday(now)}</Kicker>
          <Kicker>SESSION {String(TODAY.session).padStart(2, '0')}</Kicker>
        </View>
      </View>

      <View style={{ flex: 1, flexDirection: 'row', gap: s(72) }}>
        <View style={{ flex: 1.55, gap: s(18) }}>
          <Kicker>TODAY'S SESSION — {TODAY.minutes} MIN</Kicker>
          <Headline lead={TODAY.titleLead} italic={TODAY.titleItalic} size={104} />
          <Text style={{ fontFamily: fonts.sans, fontSize: s(24), lineHeight: s(35), color: colors.inkSoft, maxWidth: s(600) }}>{TODAY.summary}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(28), marginTop: s(10) }}>
            <FocusButton label="Start session" onPress={onStart} preferredFocus />
            <FocusButton label="Swap a move" onPress={() => {}} variant="link" fontSize={22} />
            <FocusButton label="Move without camera" onPress={onNoCamera} variant="link" fontSize={22} />
          </View>
          <View style={{ marginLeft: s(40), marginTop: s(4) }}>
            <PenNote size={26}>{TODAY.coachNote}</PenNote>
          </View>
        </View>

        <View style={{ flex: 1, gap: s(26), borderLeftWidth: s(1.5), borderLeftColor: colors.ink, paddingLeft: s(40) }}>
          <Kicker>THIS WEEK</Kicker>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {week.map(({ day, state }, i) => (
              <View key={i} style={{ alignItems: 'center', gap: s(8) }}>
                <Kicker color={state === 'missed' || state === 'ahead' ? colors.pencil : colors.ink}>{day}</Kicker>
                {state === 'done' ? <Tick size={s(34)} /> : state === 'missed' ? <Dash size={s(34)} /> : state === 'today' ? <PenCircle size={s(34)} /> : <View style={{ width: s(34), height: s(34) }} />}
              </View>
            ))}
          </View>
          <Text style={{ fontFamily: fonts.displayItalic, fontSize: s(34), lineHeight: s(39), color: colors.ink }}>
            {streakLine(done)}
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

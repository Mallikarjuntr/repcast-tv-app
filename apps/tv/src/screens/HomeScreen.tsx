import { Text, View } from 'react-native';
import { Dash, PenCircle, Tick } from '../components/Marks';
import { FocusButton } from '../components/FocusButton';
import { Headline, Kicker, PenNote, Wordmark } from '../components/Type';
import { weekView, type SessionRecord } from '../storage';
import { colors, fonts, useScale } from '../theme';
import { estimateSeconds, type Session } from '../workouts';

const NUMBER_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'];

function streakLine(done: number, todayDone: boolean): string {
  const word = (n: number) => NUMBER_WORDS[n] ?? String(n);
  if (todayDone) return `${word(done)} ${done === 1 ? 'day' : 'days'} this week.\nToday's in the book.`;
  if (done === 0) return 'A fresh week.\nToday makes one.';
  return `${word(done)} ${done === 1 ? 'day' : 'days'} this week.\nToday makes ${word(done + 1).toLowerCase()}.`;
}

function lastTime(record: SessionRecord | undefined): { label: string; lines: string[] } {
  if (!record) return { label: 'LAST TIME', lines: ['Nothing yet.', 'Your first session', 'shows up here.'] };
  const day = new Date(record.at).toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase();
  const lines = [`${record.reps} reps`, `${Math.max(1, Math.round(record.seconds / 60))} min`];
  if (record.mode === 'coach' && record.cleanReps !== undefined && record.reps > 0) lines.push(`${Math.round((record.cleanReps / record.reps) * 100)}% clean form`);
  else lines.push('followed along, no camera');
  return { label: `LAST TIME · ${day}`, lines };
}

function formatToday(date: Date): string {
  const day = date.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase();
  const dm = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase();
  return `${day} · ${dm}`;
}

export function HomeScreen({
  today,
  sessions,
  swapCount,
  onStart,
  onSwap,
  onNoCamera,
  profileName,
  onProgress,
  onSwitch,
}: {
  today: Session;
  sessions: SessionRecord[];
  swapCount: number;
  onStart: () => void;
  onSwap: () => void;
  onNoCamera: () => void;
  /** Who's training; shown so a household always knows whose page this is. */
  profileName: string;
  onProgress: () => void;
  onSwitch: () => void;
}) {
  const s = useScale();
  const now = new Date();
  const week = weekView(sessions, now);
  const last = lastTime(sessions[sessions.length - 1]);
  const minutes = Math.round(estimateSeconds(today) / 60);
  const done = week.filter((d) => d.state === 'done').length;
  // Carry the coach's advice from the last coached session over to today.
  const advice = sessions[sessions.length - 1]?.nextTime;
  const penNote = advice ? `last time's note —\n${advice.charAt(0).toUpperCase()}${advice.slice(1)}` : today.coachNote;
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper, paddingTop: s(40), paddingHorizontal: s(64), paddingBottom: s(36), gap: s(28) }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Wordmark />
        <View style={{ alignItems: 'flex-end' }}>
          <Kicker>{formatToday(now)}</Kicker>
          <Kicker>
            {profileName.toUpperCase()} · SESSION {String(sessions.length + 1).padStart(2, '0')}
          </Kicker>
        </View>
      </View>

      <View style={{ flex: 1, flexDirection: 'row', gap: s(72) }}>
        <View style={{ flex: 1.55, gap: s(18) }}>
          <Kicker>
            TODAY'S SESSION — {minutes} MIN{swapCount > 0 ? ` · ${swapCount} ${swapCount === 1 ? 'MOVE' : 'MOVES'} SWAPPED` : ''}
          </Kicker>
          <Headline lead={today.title} italic={today.titleItalic} size={104} />
          <Text style={{ fontFamily: fonts.sans, fontSize: s(24), lineHeight: s(35), color: colors.inkSoft, maxWidth: s(600) }}>{today.summary}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(28), marginTop: s(10) }}>
            <FocusButton label="Start session" onPress={onStart} preferredFocus />
            <FocusButton label="Swap a move" onPress={onSwap} variant="link" fontSize={22} />
            <FocusButton label="Move without camera" onPress={onNoCamera} variant="link" fontSize={22} />
          </View>
          <View style={{ marginLeft: s(40), marginTop: s(4) }}>
            <PenNote size={26}>{penNote}</PenNote>
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
            {streakLine(done, week[(now.getDay() + 6) % 7]?.state === 'done')}
          </Text>
          <View style={{ borderTopWidth: s(1.5), borderTopColor: colors.faint, paddingTop: s(22), gap: s(10) }}>
            <Kicker>{last.label}</Kicker>
            {last.lines.map((line) => (
              <Text key={line} style={{ fontFamily: fonts.mono, fontSize: s(20), lineHeight: s(32), color: colors.ink }}>
                {line}
              </Text>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: s(24), marginTop: 'auto' }}>
            <FocusButton label="Progress" onPress={onProgress} variant="link" fontSize={20} />
            <FocusButton label="Who's training?" onPress={onSwitch} variant="link" fontSize={20} />
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

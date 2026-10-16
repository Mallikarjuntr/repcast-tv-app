import { Text, View } from 'react-native';
import { FocusButton } from '../components/FocusButton';
import { Card, StatTile } from '../components/Studio';
import { Headline, Kicker } from '../components/Type';
import { colors, fonts, useScale } from '../theme';
import { receiptHeadline, type CoachNote, type WorkoutSummary } from '../summary';
import type { RepNote } from '../useLiveWorkout';

/** "4 MIN 32 S": spelled out, so it can't be read as the clock time next to it. */
function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  return m > 0 ? `${m} MIN ${seconds % 60} S` : `${seconds} S`;
}

function stamp(date: Date): string {
  const day = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase().replace(',', '');
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toUpperCase();
  return `${day} · ${time}`;
}

/** One square per attempt: clean (accent), counted with a note (grey), didn't count (red outline). */
function RepSquare({ note }: { note: RepNote }) {
  const s = useScale();
  const clean = note.counted && note.verdict === 'good';
  return (
    <View
      style={{
        width: s(16),
        height: s(16),
        borderRadius: s(4),
        backgroundColor: !note.counted ? 'transparent' : clean ? colors.accent : colors.faint,
        borderWidth: note.counted ? 0 : s(2),
        borderColor: colors.fault,
      }}
    />
  );
}

function Legend({ color, outline, children }: { color: string; outline?: boolean; children: string }) {
  const s = useScale();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
      <View style={{ width: s(11), height: s(11), borderRadius: s(3), backgroundColor: outline ? 'transparent' : color, borderWidth: outline ? s(2) : 0, borderColor: color }} />
      <Text style={{ fontFamily: fonts.sans, fontSize: s(13), color: colors.textSoft }}>{children}</Text>
    </View>
  );
}

export interface ReceiptProps {
  summary: WorkoutSummary;
  history: RepNote[];
  coach: { note: CoachNote; writing: boolean };
  sessionNumber: number;
  streak: number;
  finishedAt: Date;
  onDone: () => void;
}

/** After a coached workout: what counted, every attempt set by set, and the coach's note. */
export function ReceiptScreen({ summary, history, coach, sessionNumber, streak, finishedAt, onDone }: ReceiptProps) {
  const s = useScale();
  const headline = receiptHeadline(summary);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: s(40), paddingHorizontal: s(64), paddingBottom: s(36), gap: s(22) }}>
      <View style={{ gap: s(12) }}>
        <Kicker color={colors.accent}>
          SESSION {String(sessionNumber).padStart(3, '0')} · {stamp(finishedAt)} · {formatDuration(summary.seconds)} · {streak} {streak === 1 ? 'DAY' : 'DAYS'} IN A ROW
        </Kicker>
        <Headline text={`${headline.lead}${headline.italic}`.replace('\n', ' ')} size={72} />
      </View>

      <View style={{ flex: 1, flexDirection: 'row', gap: s(24) }}>
        <View style={{ width: s(430), gap: s(14) }}>
          <View style={{ flexDirection: 'row', gap: s(12) }}>
            <StatTile style={{ flex: 1 }} size={52} value={`${summary.counted}`} label="TOTAL REPS" />
            <StatTile style={{ flex: 1 }} size={52} value={summary.cleanPct === null ? '—' : `${summary.cleanPct}%`} label="CLEAN FORM" color={colors.accent} />
            <StatTile style={{ flex: 1 }} size={52} value={`${summary.noReps}`} label="DIDN'T COUNT" />
          </View>
          <Card style={{ flex: 1, gap: s(10), borderLeftWidth: s(5), borderLeftColor: colors.accent }}>
            <Kicker size={13} color={colors.accent}>
              YOUR COACH'S NOTE
            </Kicker>
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: s(21), lineHeight: s(29), color: colors.text }}>{coach.note.note}</Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: s(19), lineHeight: s(27), color: colors.textSoft }}>Next time: {coach.note.nextTime}</Text>
            <Text style={{ marginTop: 'auto', fontFamily: fonts.sans, fontSize: s(13), color: colors.faint }}>
              {coach.writing
                ? 'Your coach is still writing…'
                : coach.note.source === 'ai'
                  ? 'Written by your AI coach · Claude on Amazon Bedrock'
                  : 'Written by Spotter from your reps'}
            </Text>
          </Card>
        </View>

        <Card style={{ flex: 1, gap: s(2) }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: s(8) }}>
            <Kicker size={12}>EVERY ATTEMPT, AS YOUR PHONE JUDGED IT</Kicker>
            <View style={{ flexDirection: 'row', gap: s(14) }}>
              <Legend color={colors.accent}>Clean</Legend>
              <Legend color={colors.faint}>With a note</Legend>
              <Legend color={colors.fault} outline>
                Didn't count
              </Legend>
            </View>
          </View>
          {summary.sets.map((set, setIndex) => (
            <View key={setIndex} style={{ flexDirection: 'row', alignItems: 'center', gap: s(14), paddingVertical: s(8), borderTopWidth: s(1), borderTopColor: colors.line }}>
              <Text style={{ width: s(190), fontFamily: fonts.sansBold, fontSize: s(14), letterSpacing: s(1), color: colors.text }} numberOfLines={1}>
                {set.label}
              </Text>
              <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: s(3) }}>
                {history
                  .filter((n) => n.set === setIndex)
                  .map((n, i) => (
                    <RepSquare key={i} note={n} />
                  ))}
              </View>
              <Text style={{ width: s(40), textAlign: 'right', fontFamily: fonts.sansBold, fontSize: s(16), color: colors.textSoft }}>{set.counted}</Text>
            </View>
          ))}
        </Card>
      </View>

      <View style={{ flexDirection: 'row', marginLeft: -s(6) }}>
        <FocusButton label="Done for today" onPress={onDone} preferredFocus />
      </View>
    </View>
  );
}

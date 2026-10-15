import { useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { FocusButton } from '../components/FocusButton';
import { Cross, Tick } from '../components/Marks';
import { Headline, Kicker } from '../components/Type';
import { colors, fonts, useScale } from '../theme';
import { receiptHeadline, type CoachNote, type WorkoutSummary } from '../summary';
import type { RepNote } from '../useLiveWorkout';

const RECEIPT_W = 420;

function formatTime(seconds: number): string {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function stamp(date: Date): string {
  const day = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase().replace(',', '');
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toUpperCase();
  return `${day} · ${time}`;
}

/** Zig-zag bottom edge, as if torn off a till roll. */
function TornEdge({ width, height }: { width: number; height: number }) {
  const teeth = 21;
  const step = width / teeth;
  let d = `M0 0 H${width} V${height * 0.15}`;
  for (let i = teeth; i > 0; i--) d += ` L${(i - 0.5) * step} ${height} L${(i - 1) * step} ${height * 0.15}`;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Path d={`${d} Z`} fill={colors.paperBright} />
    </Svg>
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

/** After a coached workout: the till receipt of what counted, and the coach's handwritten note. */
export function ReceiptScreen({ summary, history, coach, sessionNumber, streak, finishedAt, onDone }: ReceiptProps) {
  const s = useScale();
  const [showReps, setShowReps] = useState(false);
  const headline = receiptHeadline(summary);

  const mono = { fontFamily: fonts.mono, fontSize: s(17), lineHeight: s(30), color: colors.ink };
  const monoBold = { ...mono, fontFamily: fonts.monoMedium };
  const row = (left: ReactNode, right: ReactNode, bold = false, key?: string) => (
    <View key={key} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={bold ? monoBold : mono}>{left}</Text>
      {typeof right === 'string' || typeof right === 'number' ? <Text style={bold ? monoBold : mono}>{right}</Text> : right}
    </View>
  );
  const rule = <View style={{ borderTopWidth: s(1.5), borderStyle: 'dashed', borderTopColor: colors.faint, marginVertical: s(12) }} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.paperDeep, paddingVertical: s(40), paddingHorizontal: s(64), flexDirection: 'row', gap: s(72) }}>
      <View style={{ width: s(RECEIPT_W), marginTop: s(6), transform: [{ rotate: '-1.6deg' }] }}>
        <View style={{ backgroundColor: colors.paperBright, paddingTop: s(28), paddingHorizontal: s(32), paddingBottom: s(18) }}>
          <Text style={{ textAlign: 'center', fontFamily: fonts.displayBoldItalic, fontSize: s(30), lineHeight: s(36), color: colors.ink }}>spotter</Text>
          <Text style={{ ...mono, textAlign: 'center', fontSize: s(14), letterSpacing: s(1), color: colors.pencil }}>
            SESSION {String(sessionNumber).padStart(3, '0')} · {stamp(finishedAt)}
          </Text>
          {rule}
          {summary.sets.map((set, i) => row(set.label, `${set.counted}`, false, `set-${i}`))}
          {summary.noReps > 0 ? row("DIDN'T COUNT", `${summary.noReps}`) : null}
          {rule}
          {row('TOTAL REPS', `${summary.counted}`, true)}
          {row(
            'CLEAN FORM',
            <Text style={{ ...monoBold, backgroundColor: colors.highlighter, paddingHorizontal: s(6) }}>{summary.cleanPct === null ? '—' : `${summary.cleanPct}%`}</Text>,
            true,
          )}
          {row('TIME', formatTime(summary.seconds))}
          {row('STREAK', `${streak} ${streak === 1 ? 'DAY' : 'DAYS'}`)}
          {rule}
          <Text style={{ ...mono, textAlign: 'center', fontSize: s(14), letterSpacing: s(1), color: colors.pencil }}>THANK YOU FOR SHOWING UP</Text>
        </View>
        <TornEdge width={s(RECEIPT_W)} height={s(14)} />
      </View>

      <View style={{ flex: 1, gap: s(24), paddingTop: s(10) }}>
        <Headline lead={headline.lead} italic={headline.italic} size={74} />

        {showReps ? (
          <View style={{ gap: s(16), backgroundColor: colors.paper, paddingVertical: s(22), paddingHorizontal: s(28) }}>
            {summary.sets.map((_, setIndex) => (
              <View key={setIndex} style={{ flexDirection: 'row', alignItems: 'center', gap: s(16) }}>
                <View style={{ width: s(170) }}>
                  <Kicker size={14}>{summary.sets[setIndex]!.label.replace(' · SET ', ' ')}</Kicker>
                </View>
                <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: s(2) }}>
                  {history
                    .filter((n) => n.set === setIndex)
                    .map((n, i) => (
                      <View key={i}>{n.counted ? <Tick size={s(30)} color={n.verdict === 'good' ? colors.ink : colors.pen} /> : <Cross size={s(30)} />}</View>
                    ))}
                </View>
              </View>
            ))}
            <View style={{ flexDirection: 'row', gap: s(26), alignItems: 'center', marginTop: s(4) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
                <Tick size={s(22)} />
                <Kicker size={13}>CLEAN</Kicker>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
                <Tick size={s(22)} color={colors.pen} />
                <Kicker size={13}>COUNTED, WITH A NOTE</Kicker>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
                <Cross size={s(22)} />
                <Kicker size={13}>DIDN'T COUNT</Kicker>
              </View>
            </View>
          </View>
        ) : (
          <View style={{ backgroundColor: colors.paper, paddingVertical: s(22), paddingHorizontal: s(28), maxWidth: s(620), transform: [{ rotate: '0.8deg' }] }}>
            <Text style={{ fontFamily: fonts.hand, fontSize: s(27), lineHeight: s(38), color: colors.pen }}>
              {coach.note.note}
              {'\n'}Next time: {coach.note.nextTime}
            </Text>
            <Text style={{ fontFamily: fonts.hand, fontSize: s(24), lineHeight: s(32), color: colors.pen, textAlign: 'right', marginTop: s(4) }}>
              {coach.writing ? 'your coach is still writing…' : '— your spotter'}
            </Text>
          </View>
        )}

        <Kicker size={13}>
          {showReps
            ? 'EVERY ATTEMPT, IN ORDER, AS YOUR PHONE JUDGED IT'
            : coach.note.source === 'ai'
              ? 'NOTE WRITTEN BY YOUR AI COACH · CLAUDE ON AMAZON BEDROCK'
              : 'NOTE WRITTEN BY SPOTTER FROM YOUR REPS'}
        </Kicker>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(28), marginTop: 'auto' }}>
          <FocusButton label="Done for today" onPress={onDone} preferredFocus />
          <FocusButton label={showReps ? 'Back to the note' : 'See every rep'} onPress={() => setShowReps((v) => !v)} variant="link" fontSize={22} />
        </View>
      </View>
    </View>
  );
}

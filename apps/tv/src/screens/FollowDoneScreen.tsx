import { Text, View } from 'react-native';
import { FocusButton } from '../components/FocusButton';
import { Dash, PenCircle, Swash, Tick } from '../components/Marks';
import { Headline, Kicker, PenNote } from '../components/Type';
import type { DayState } from '../storage';
import { colors, fonts, useScale } from '../theme';
import type { Session } from '../workouts';

function line(s: Session['steps'][number]): [string, string] {
  if (s.kind === 'timed') return [s.name, `${s.seconds} s`];
  return [s.name, `${s.sets} × ${s.reps}`];
}

/** End of a Core mode workout: what was done, as a short receipt, and how the week looks now. */
export function FollowDoneScreen({
  session,
  reps,
  seconds,
  week,
  onHome,
  onCoach,
}: {
  session: Session;
  reps: number;
  seconds: number;
  week: { day: string; state: DayState }[];
  onHome: () => void;
  onCoach: () => void;
}) {
  const s = useScale();
  const minutes = Math.max(1, Math.round(seconds / 60));
  const days = week.filter((d) => d.state === 'done').length;
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper, paddingTop: s(40), paddingHorizontal: s(64), paddingBottom: s(36), flexDirection: 'row', gap: s(72) }}>
      <View style={{ flex: 1.3, gap: s(20), justifyContent: 'center' }}>
        <Kicker>FOLLOW ALONG · DONE</Kicker>
        <Headline lead={`${reps} reps,\n`} italic={`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`} size={110} />
        <Swash width={s(260)} />
        <Text style={{ fontFamily: fonts.sans, fontSize: s(24), lineHeight: s(35), color: colors.inkSoft, maxWidth: s(600) }}>
          Counted by the beat, so it's as honest as you were. Want every rep checked? Smart coaching watches your form through your phone.
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(28), marginTop: s(8) }}>
          <FocusButton label="Back home" onPress={onHome} preferredFocus />
          <FocusButton label="Try Smart coaching" onPress={onCoach} variant="link" fontSize={22} />
        </View>
      </View>

      <View style={{ flex: 1, justifyContent: 'center' }}>
        <View style={{ backgroundColor: colors.paperBright, paddingVertical: s(28), paddingHorizontal: s(32), gap: s(10), transform: [{ rotate: '1deg' }] }}>
          <Kicker color={colors.ink}>{session.title.replace('\n', ' ').trim()} {session.titleItalic}</Kicker>
          <View style={{ borderTopWidth: s(1.5), borderStyle: 'dashed', borderTopColor: colors.faint, marginVertical: s(6) }} />
          {session.steps.map((step) => {
            const [name, amount] = line(step);
            return (
              <View key={step.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: fonts.mono, fontSize: s(20), lineHeight: s(32), color: colors.ink }}>{name}</Text>
                <Text style={{ fontFamily: fonts.mono, fontSize: s(20), lineHeight: s(32), color: colors.ink }}>{amount}</Text>
              </View>
            );
          })}
          <View style={{ borderTopWidth: s(1.5), borderStyle: 'dashed', borderTopColor: colors.faint, marginVertical: s(6) }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: fonts.monoMedium, fontSize: s(22), color: colors.ink }}>TOTAL</Text>
            <Text style={{ fontFamily: fonts.monoMedium, fontSize: s(22), color: colors.ink }}>{reps} reps</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: s(14) }}>
            {week.map(({ day, state }, i) => (
              <View key={i} style={{ alignItems: 'center', gap: s(6) }}>
                <Kicker size={14} color={state === 'missed' || state === 'ahead' ? colors.pencil : colors.ink}>{day}</Kicker>
                {state === 'done' ? <Tick size={s(26)} /> : state === 'missed' ? <Dash size={s(26)} /> : state === 'today' ? <PenCircle size={s(26)} /> : <View style={{ width: s(26), height: s(26) }} />}
              </View>
            ))}
          </View>
        </View>
        <View style={{ marginTop: s(26), marginLeft: s(24) }}>
          <PenNote size={28}>{days > 1 ? `${days} days this week. Keep it going.` : 'Day one of the week. Nice.'}</PenNote>
        </View>
      </View>
    </View>
  );
}

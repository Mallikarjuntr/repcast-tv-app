import { Text, View } from 'react-native';
import { FocusButton } from '../components/FocusButton';
import { Card, StatTile, WeekStrip } from '../components/Studio';
import { Headline, Kicker, Note } from '../components/Type';
import type { DayState } from '../storage';
import { colors, fonts, useScale } from '../theme';
import type { Step } from '../workouts';

function amount(step: Step): string {
  return step.kind === 'timed' ? `${step.seconds} s` : `${step.sets} × ${step.reps}`;
}

/** End of a follow-along move: what was done, how the week looks now, and what next. */
export function FollowDoneScreen({
  move,
  reps,
  seconds,
  week,
  onAnother,
  onHome,
}: {
  move: Step;
  reps: number;
  seconds: number;
  week: { day: string; state: DayState }[];
  onAnother: () => void;
  onHome: () => void;
}) {
  const s = useScale();
  const minutes = Math.max(1, Math.round(seconds / 60));
  const days = week.filter((d) => d.state === 'done').length;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: s(44), paddingHorizontal: s(64), paddingBottom: s(40), flexDirection: 'row', gap: s(48) }}>
      <View style={{ flex: 1, gap: s(20) }}>
        <Kicker color={colors.accent}>FOLLOW ALONG · DONE</Kicker>
        <Headline text={`That's\n${move.name}.`} size={96} />
        <View style={{ flexDirection: 'row', gap: s(12) }}>
          {move.kind === 'reps' ? (
            <StatTile style={{ width: s(170) }} value={`${reps}`} label={reps === 1 ? 'REP' : 'REPS'} />
          ) : (
            <StatTile style={{ width: s(170) }} value={`${Math.min(seconds, move.seconds)}`} label="SECONDS HELD" />
          )}
          <StatTile style={{ width: s(170) }} value={`${minutes}`} label={minutes === 1 ? 'MINUTE' : 'MINUTES'} />
          <StatTile style={{ width: s(170) }} value={`${days}`} label="DAYS THIS WEEK" color={colors.accent} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(24) }}>
          <WeekStrip week={week} size={36} />
          <Text style={{ fontFamily: fonts.sansBold, fontSize: s(20), color: colors.text, flexShrink: 1 }}>{days > 1 ? `${days} days this week. Keep it going.` : 'Day one of the week. Nice.'}</Text>
        </View>
        <View style={{ marginTop: 'auto', gap: s(14) }}>
          <View style={{ maxWidth: s(640) }}>
            <Note size={17} color={colors.muted}>
              Counted by the beat, so it's as honest as you were. Want every rep checked? Coach me on camera watches your form through your phone.
            </Note>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10), marginLeft: -s(6) }}>
            <FocusButton label="Another move" onPress={onAnother} preferredFocus />
            <FocusButton label="Back home" onPress={onHome} variant="secondary" />
          </View>
        </View>
      </View>

      <Card style={{ width: s(360), gap: s(6), alignSelf: 'flex-start', marginTop: s(36) }}>
        <Kicker size={13}>YOU DID</Kicker>
        <Text style={{ fontFamily: fonts.display, fontSize: s(34), color: colors.text }}>{move.name.toUpperCase()}</Text>
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: s(18), color: colors.muted }}>{amount(move)}</Text>
        <Note size={16}>{move.why}</Note>
      </Card>
    </View>
  );
}

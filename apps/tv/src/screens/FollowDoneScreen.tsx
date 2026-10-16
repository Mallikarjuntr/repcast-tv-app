import { Text, View } from 'react-native';
import { FocusButton } from '../components/FocusButton';
import { Card, StatTile, WeekStrip } from '../components/Studio';
import { Headline, Kicker, Note } from '../components/Type';
import type { DayState } from '../storage';
import { colors, fonts, useScale } from '../theme';
import type { Session, Step } from '../workouts';

function amount(step: Step): string {
  return step.kind === 'timed' ? `${step.seconds} s` : `${step.sets} × ${step.reps}`;
}

/** End of a Core mode workout: what was done, and how the week looks now. */
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
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: s(44), paddingHorizontal: s(64), paddingBottom: s(40), flexDirection: 'row', gap: s(48) }}>
      <View style={{ flex: 1, gap: s(20) }}>
        <Kicker color={colors.accent}>FOLLOW ALONG · DONE</Kicker>
        <Headline text={"That's the\nsession."} size={104} />
        <View style={{ flexDirection: 'row', gap: s(12) }}>
          <StatTile style={{ width: s(170) }} value={`${reps}`} label={reps === 1 ? 'REP' : 'REPS'} />
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
              Counted by the beat, so it's as honest as you were. Want every rep checked? Smart coaching watches your form through your phone.
            </Note>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10), marginLeft: -s(6) }}>
            <FocusButton label="Back home" onPress={onHome} preferredFocus />
            <FocusButton label="Try Smart coaching" onPress={onCoach} variant="secondary" />
          </View>
        </View>
      </View>

      <Card style={{ width: s(360), gap: s(4), alignSelf: 'flex-start', marginTop: s(36) }}>
        <Kicker size={13}>{`${session.title}${session.titleItalic}`.replace(/\s*\n\s*/g, ' ').replace(/\.$/, '').toUpperCase()}</Kicker>
        {session.steps.map((step) => (
          <View key={step.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: s(8), borderTopWidth: s(1), borderTopColor: colors.line }}>
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: s(18), color: colors.text }}>{step.name}</Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: s(18), color: colors.muted }}>{amount(step)}</Text>
          </View>
        ))}
      </Card>
    </View>
  );
}

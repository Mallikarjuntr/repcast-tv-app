import { Text, View } from 'react-native';
import { BackButton } from '../components/FocusButton';
import { Card, StatTile } from '../components/Studio';
import { Headline, Kicker, Note } from '../components/Type';
import { bestStreak, calendarWeeks, cleanTrend, totals, type DayStat } from '../progress';
import { streakDays, type Profile, type SessionRecord } from '../storage';
import { colors, fonts, useScale } from '../theme';

const WEEKS = 6;
const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function DayCell({ day }: { day: DayStat }) {
  const s = useScale();
  const done = day.sessions > 0;
  return (
    <View
      style={{
        flex: 1,
        height: s(34),
        borderRadius: s(7),
        backgroundColor: done ? colors.accent : day.isFuture ? 'transparent' : colors.line,
        // Every cell has the same border (mostly invisible): in a flex row a border adds to a cell's width.
        borderWidth: s(2.5),
        borderColor: day.isToday ? colors.text : day.isFuture ? colors.line : 'transparent',
        paddingHorizontal: s(5),
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: fonts.sansSemi, fontSize: s(11), color: done ? colors.onAccent : day.isFuture ? colors.dim : colors.faint }}>
        {day.date.getDate()}
      </Text>
    </View>
  );
}

/** One person's progress, day by day: what they did, how often, and whether their form is getting cleaner. */
export function ProgressScreen({ profile, sessions, onBack }: { profile: Profile; sessions: SessionRecord[]; onBack: () => void }) {
  const s = useScale();
  const weeks = calendarWeeks(sessions, WEEKS);
  const t = totals(sessions);
  const trend = cleanTrend(sessions);
  const possessive = profile.name === 'Me' ? 'My' : `${profile.name}'s`;
  const first = trend[0];
  const latest = trend[trend.length - 1];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: s(44), paddingHorizontal: s(64), paddingBottom: s(40), gap: s(24) }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View style={{ gap: s(12) }}>
          <Kicker color={colors.accent}>{profile.name.toUpperCase()} · LAST {WEEKS} WEEKS</Kicker>
          <Headline text={`${possessive} progress`} size={76} />
        </View>
        <BackButton onPress={onBack} preferredFocus />
      </View>

      <View style={{ flexDirection: 'row', gap: s(14) }}>
        <StatTile style={{ flex: 1 }} value={`${streakDays(sessions)}`} label="DAYS IN A ROW NOW" color={colors.accent} />
        <StatTile style={{ flex: 1 }} value={`${bestStreak(sessions)}`} label="BEST RUN OF DAYS" />
        <StatTile style={{ flex: 1 }} value={`${t.sessions}`} label={`SESSIONS · ${t.coached} ON CAMERA`} />
        <StatTile style={{ flex: 1 }} value={t.reps.toLocaleString('en-IN')} label={`REPS · ${t.minutes} ${t.minutes === 1 ? 'MINUTE' : 'MINUTES'}`} />
      </View>

      <View style={{ flex: 1, flexDirection: 'row', gap: s(22) }}>
        <Card style={{ width: s(470), gap: s(8) }}>
          <Kicker size={14}>DAY BY DAY</Kicker>
          <View style={{ flexDirection: 'row', gap: s(7) }}>
            {DAY_LETTERS.map((d, i) => (
              <Text key={i} style={{ flex: 1, textAlign: 'center', fontFamily: fonts.sansBold, fontSize: s(12), color: colors.faint }}>
                {d}
              </Text>
            ))}
          </View>
          {weeks.map((week, w) => (
            <View key={w} style={{ flexDirection: 'row', gap: s(7) }}>
              {week.map((day, d) => (
                <DayCell key={d} day={day} />
              ))}
            </View>
          ))}
        </Card>

        <Card style={{ flex: 1, gap: s(12) }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Kicker size={14}>{trend.length > 0 ? `CLEAN FORM · LAST ${trend.length} ON CAMERA` : 'CLEAN FORM'}</Kicker>
            {trend.length > 1 && first !== undefined && latest !== undefined ? (
              <Text style={{ fontFamily: fonts.sans, fontSize: s(15), color: colors.textSoft }}>
                {latest > first ? `up from ${first}% to ${latest}%` : latest === first ? `steady at ${latest}%` : `${first}% then, ${latest}% now`}
              </Text>
            ) : null}
          </View>
          {trend.length === 0 ? (
            <Note size={18} color={colors.muted}>
              {sessions.length === 0 ? 'Your first workout lights up the first day.' : 'A session coached on camera starts this chart.'}
            </Note>
          ) : (
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: s(12) }}>
              {trend.map((pct, i) => (
                <View key={i} style={{ width: s(52), alignItems: 'center', gap: s(6) }}>
                  <Text style={{ fontFamily: fonts.sansBold, fontSize: s(13), color: colors.textSoft }}>{pct}</Text>
                  <View style={{ width: '100%', height: (s(170) * Math.max(pct, 3)) / 100, borderTopLeftRadius: s(6), borderTopRightRadius: s(6), borderRadius: s(2), backgroundColor: i === trend.length - 1 ? colors.accent : colors.dim }} />
                </View>
              ))}
            </View>
          )}
        </Card>
      </View>
    </View>
  );
}

import { Text, View } from 'react-native';
import { BackButton } from '../components/FocusButton';
import { Card, StatTile } from '../components/Studio';
import { Headline, Kicker, Note } from '../components/Type';
import { bestStreak, cleanTrend, moveShare, totals, yearGrid, type YearDay } from '../progress';
import { streakDays, type Profile, type SessionRecord } from '../storage';
import { colors, fonts, useScale } from '../theme';

/** The accent laid over the card colour at 25 / 50 / 75 / 100%: more reps, more orange. */
const LEVELS = [colors.line, '#593523', '#904C2B', '#C86334', colors.accent] as const;
/** The moves bar, like a code-languages bar: biggest first. */
const MOVE_COLOURS = [colors.accent, colors.good, '#E8B04B', '#7FA7D9', '#C792C9', colors.dim];
const CELL = 16;
const GAP = 4;

function Square({ day }: { day: YearDay }) {
  const s = useScale();
  return (
    <View
      style={{
        width: s(CELL),
        height: s(CELL),
        borderRadius: s(3.5),
        backgroundColor: day.isFuture ? 'transparent' : LEVELS[day.level],
        borderWidth: day.isToday ? s(2) : 0,
        borderColor: colors.text,
      }}
    />
  );
}

/** A year of training as a GitHub-style calendar: one square per day, columns are weeks. */
function YearCalendar({ sessions }: { sessions: SessionRecord[] }) {
  const s = useScale();
  const grid = yearGrid(sessions);
  const step = s(CELL + GAP);
  return (
    <Card style={{ gap: s(12) }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ fontFamily: fonts.displaySemi, fontSize: s(24), color: colors.text }}>
          {grid.reps.toLocaleString('en-IN')} reps on {grid.activeDays} {grid.activeDays === 1 ? 'day' : 'days'} in the last year
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(5) }}>
          <Text style={{ fontFamily: fonts.sans, fontSize: s(13), color: colors.faint, marginRight: s(4) }}>Less</Text>
          {LEVELS.map((c) => (
            <View key={c} style={{ width: s(CELL), height: s(CELL), borderRadius: s(3.5), backgroundColor: c }} />
          ))}
          <Text style={{ fontFamily: fonts.sans, fontSize: s(13), color: colors.faint, marginLeft: s(4) }}>More</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: s(8) }}>
        {/* Day names, every other row as GitHub does. */}
        <View style={{ paddingTop: s(20), gap: s(GAP) }}>
          {['Mon', '', 'Wed', '', 'Fri', '', 'Sun'].map((d, i) => (
            <Text key={i} style={{ height: s(CELL), fontFamily: fonts.sans, fontSize: s(11), lineHeight: s(CELL), color: colors.faint }}>
              {d}
            </Text>
          ))}
        </View>
        <View style={{ gap: s(6) }}>
          <View style={{ height: s(14) }}>
            {grid.months.map((m) => (
              <Text key={m.week} style={{ position: 'absolute', left: m.week * step, fontFamily: fonts.sans, fontSize: s(12), color: colors.faint }}>
                {m.label}
              </Text>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: s(GAP) }}>
            {grid.weeks.map((week, w) => (
              <View key={w} style={{ gap: s(GAP) }}>
                {week.map((day, d) => (
                  <Square key={d} day={day} />
                ))}
              </View>
            ))}
          </View>
        </View>
      </View>
    </Card>
  );
}

/** One person's progress: a year at a glance, streaks, clean form and the moves they train most. */
export function ProgressScreen({ profile, sessions, onBack }: { profile: Profile; sessions: SessionRecord[]; onBack: () => void }) {
  const s = useScale();
  const t = totals(sessions);
  const trend = cleanTrend(sessions);
  const moves = moveShare(sessions);
  const possessive = profile.name === 'Me' ? 'My' : `${profile.name}'s`;
  const first = trend[0];
  const latest = trend[trend.length - 1];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: s(30), paddingHorizontal: s(56), paddingBottom: s(26), gap: s(14) }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View style={{ gap: s(8) }}>
          <Kicker color={colors.accent}>{profile.name.toUpperCase()} · THE LAST 12 MONTHS</Kicker>
          <Headline text={`${possessive} progress`} size={56} />
        </View>
        <BackButton onPress={onBack} preferredFocus />
      </View>

      <View style={{ flexDirection: 'row', gap: s(12) }}>
        <StatTile style={{ flex: 1 }} size={44} value={`${streakDays(sessions)}`} label="DAYS IN A ROW NOW" color={colors.accent} />
        <StatTile style={{ flex: 1 }} size={44} value={`${bestStreak(sessions)}`} label="BEST RUN OF DAYS" />
        <StatTile style={{ flex: 1 }} size={44} value={`${t.sessions}`} label={`SESSIONS · ${t.coached} ON CAMERA`} />
        <StatTile style={{ flex: 1 }} size={44} value={t.reps.toLocaleString('en-IN')} label={`REPS · ${t.minutes} ${t.minutes === 1 ? 'MINUTE' : 'MINUTES'}`} />
      </View>

      <YearCalendar sessions={sessions} />

      <View style={{ flex: 1, flexDirection: 'row', gap: s(12) }}>
        <Card style={{ flex: 1, gap: s(10) }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Kicker size={13}>{trend.length > 0 ? `CLEAN FORM · LAST ${trend.length} ON CAMERA` : 'CLEAN FORM'}</Kicker>
            {trend.length > 1 && first !== undefined && latest !== undefined ? (
              <Text style={{ fontFamily: fonts.sans, fontSize: s(14), color: colors.textSoft }}>
                {latest > first ? `up from ${first}% to ${latest}%` : latest === first ? `steady at ${latest}%` : `${first}% then, ${latest}% now`}
              </Text>
            ) : null}
          </View>
          {trend.length === 0 ? (
            <Note size={16} color={colors.muted}>
              {sessions.length === 0 ? 'Your first workout lights up the first square.' : 'A session coached on camera starts this chart.'}
            </Note>
          ) : (
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: s(10) }}>
              {trend.map((pct, i) => (
                <View key={i} style={{ flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center', gap: s(4) }}>
                  <Text style={{ fontFamily: fonts.sansBold, fontSize: s(12), color: colors.textSoft }}>{pct}</Text>
                  <View style={{ width: '80%', height: `${Math.max(pct, 3) * 0.78}%`, borderTopLeftRadius: s(5), borderTopRightRadius: s(5), backgroundColor: i === trend.length - 1 ? colors.accent : colors.dim }} />
                </View>
              ))}
            </View>
          )}
        </Card>

        <Card style={{ flex: 1, gap: s(12) }}>
          <Kicker size={13}>MOVES YOU TRAIN MOST</Kicker>
          {moves.length === 0 ? (
            <Note size={16} color={colors.muted}>
              Pick a move from Start session to begin.
            </Note>
          ) : (
            <>
              <View style={{ flexDirection: 'row', height: s(12), borderRadius: s(6), overflow: 'hidden', gap: s(2) }}>
                {moves.map((m, i) => (
                  <View key={m.name} style={{ flex: m.share, backgroundColor: MOVE_COLOURS[i % MOVE_COLOURS.length] }} />
                ))}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: s(22), rowGap: s(8) }}>
                {moves.map((m, i) => (
                  <View key={m.name} style={{ flexDirection: 'row', alignItems: 'center', gap: s(7) }}>
                    <View style={{ width: s(10), height: s(10), borderRadius: s(5), backgroundColor: MOVE_COLOURS[i % MOVE_COLOURS.length] }} />
                    <Text style={{ fontFamily: fonts.sansSemi, fontSize: s(15), color: colors.text }}>{m.name}</Text>
                    <Text style={{ fontFamily: fonts.sans, fontSize: s(15), color: colors.faint }}>{Math.round(m.share * 100)}%</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </Card>
      </View>
    </View>
  );
}

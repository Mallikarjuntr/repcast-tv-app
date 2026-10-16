import { Text, View } from 'react-native';
import { FocusButton } from '../components/FocusButton';
import { PenCircle, Tick } from '../components/Marks';
import { Headline, Kicker, PenNote } from '../components/Type';
import { bestStreak, calendarWeeks, cleanTrend, totals, type DayStat } from '../progress';
import { streakDays, type Profile, type SessionRecord } from '../storage';
import { colors, fonts, useScale } from '../theme';

const WEEKS = 6;
const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function Stat({ value, label }: { value: string; label: string }) {
  const s = useScale();
  return (
    <View style={{ gap: s(2) }}>
      <Text style={{ fontFamily: fonts.displayBold, fontSize: s(54), lineHeight: s(60), color: colors.ink }}>{value}</Text>
      <Kicker size={14}>{label}</Kicker>
    </View>
  );
}

function DayCell({ day, size }: { day: DayStat; size: number }) {
  const s = useScale();
  const done = day.sessions > 0;
  return (
    <View style={{ width: size, height: size, borderWidth: s(1), borderColor: day.isFuture ? colors.paperDeep : colors.faint, backgroundColor: done ? colors.paperBright : 'transparent', padding: s(4), justifyContent: 'space-between' }}>
      <Text style={{ fontFamily: fonts.mono, fontSize: s(12), color: day.isFuture ? colors.faint : colors.pencil }}>{day.date.getDate()}</Text>
      <View style={{ alignItems: 'center' }}>
        {done ? <Tick size={size * 0.42} /> : day.isToday ? <PenCircle size={size * 0.42} /> : null}
      </View>
      <Text style={{ fontFamily: fonts.monoMedium, fontSize: s(12), color: colors.ink, textAlign: 'right' }}>{done ? `${day.reps}` : ' '}</Text>
    </View>
  );
}

/** One person's progress, day by day: what they did, how often, and whether their form is getting cleaner. */
export function ProgressScreen({ profile, sessions, onBack }: { profile: Profile; sessions: SessionRecord[]; onBack: () => void }) {
  const s = useScale();
  const weeks = calendarWeeks(sessions, WEEKS);
  const t = totals(sessions);
  const trend = cleanTrend(sessions);
  const cell = s(62);
  const possessive = profile.name === 'Me' ? 'My' : `${profile.name}'s`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper, paddingTop: s(40), paddingHorizontal: s(64), paddingBottom: s(36), gap: s(24) }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ gap: s(8) }}>
          <Kicker>PROGRESS · {profile.name.toUpperCase()}</Kicker>
          <Headline lead={`${possessive} `} italic="progress." size={72} />
        </View>
        <FocusButton label="Back" onPress={onBack} variant="link" fontSize={20} preferredFocus />
      </View>

      <View style={{ flex: 1, flexDirection: 'row', gap: s(56) }}>
        <View style={{ width: s(300), gap: s(22) }}>
          <Stat value={`${streakDays(sessions)}`} label="DAYS IN A ROW NOW" />
          <Stat value={`${bestStreak(sessions)}`} label="BEST RUN OF DAYS" />
          <Stat value={`${t.sessions}`} label={`SESSIONS · ${t.coached} WITH THE CAMERA`} />
          <Stat value={t.reps.toLocaleString('en-IN')} label={`REPS · ${t.minutes} ${t.minutes === 1 ? 'MINUTE' : 'MINUTES'}`} />
        </View>

        <View style={{ gap: s(8) }}>
          <Kicker>LAST {WEEKS} WEEKS</Kicker>
          <View style={{ flexDirection: 'row', gap: s(6) }}>
            {DAY_LETTERS.map((d, i) => (
              <View key={i} style={{ width: cell, alignItems: 'center' }}>
                <Kicker size={13}>{d}</Kicker>
              </View>
            ))}
          </View>
          {weeks.map((week, w) => (
            <View key={w} style={{ flexDirection: 'row', gap: s(6) }}>
              {week.map((day, d) => (
                <DayCell key={d} day={day} size={cell} />
              ))}
            </View>
          ))}
        </View>

        <View style={{ flex: 1, gap: s(12) }}>
          <Kicker>{trend.length > 0 ? `CLEAN FORM · LAST ${trend.length} COACHED` : 'CLEAN FORM'}</Kicker>
          {trend.length === 0 ? (
            <PenNote arrow={false} size={22}>
              a coached session with the camera starts this chart
            </PenNote>
          ) : (
            <View style={{ height: s(220), flexDirection: 'row', alignItems: 'flex-end', gap: s(8), borderBottomWidth: s(1.5), borderBottomColor: colors.ink }}>
              {trend.map((pct, i) => (
                <View key={i} style={{ flex: 1, alignItems: 'center', gap: s(4) }}>
                  <Text style={{ fontFamily: fonts.mono, fontSize: s(12), color: colors.ink }}>{pct}</Text>
                  <View style={{ width: '70%', height: (s(190) * Math.max(pct, 3)) / 100, backgroundColor: i === trend.length - 1 ? colors.highlighter : colors.paperDeep, borderWidth: s(1.5), borderColor: colors.ink }} />
                </View>
              ))}
            </View>
          )}
          {sessions.length === 0 ? (
            <PenNote arrow={false} size={22}>
              your first workout ticks the first box
            </PenNote>
          ) : null}
        </View>
      </View>
    </View>
  );
}

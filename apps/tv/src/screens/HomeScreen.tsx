import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';
import { FocusButton } from '../components/FocusButton';
import { Avatar } from '../components/Avatar';
import { PanelTag, Speaker, WeekStrip } from '../components/Studio';
import { TrainerVideo } from '../components/TrainerVideo';
import { Headline, Kicker, Note, Wordmark } from '../components/Type';
import { bestStreak } from '../progress';
import { streakDays, weekView, type SessionRecord } from '../storage';
import { colors, fonts, useScale } from '../theme';
import { TRAINER_CLIPS } from '../trainerClips';
import { isFocused } from '../tv';
import { moveById, MOVES } from '../workouts';

function lastTime(record: SessionRecord | undefined, now: Date): string | null {
  if (!record) return null;
  const at = new Date(record.at);
  const day = at.toDateString() === now.toDateString() ? 'earlier today' : at.toLocaleDateString('en-GB', { weekday: 'long' });
  const clean = record.mode === 'coach' && record.cleanReps !== undefined && record.reps > 0 ? `, ${Math.round((record.cleanReps / record.reps) * 100)}% clean` : '';
  const what = record.move ? `${record.title.toLowerCase()}, ` : '';
  return `Last time, ${day}: ${what}${record.reps} ${record.reps === 1 ? 'rep' : 'reps'}${clean}`;
}

function sentence(text: string): string {
  const flat = text.replace(/\s*\n\s*/g, ' ').trim();
  return `${flat.charAt(0).toUpperCase()}${flat.slice(1)}`;
}

function formatToday(date: Date): string {
  const day = date.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase();
  const dm = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase();
  return `${day} ${dm}`;
}

/** The person chip in the corner: who's training, and the way to switch. */
function WhoChip({ name, colour, onPress }: { name: string; colour: string; onPress: () => void }) {
  const s = useScale();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${name} is training. Switch person`} onPress={onPress}>
      {(state) => {
        const focused = isFocused(state);
        return (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: s(10),
              backgroundColor: focused ? colors.raised : colors.surface,
              borderRadius: s(999),
              borderWidth: s(3),
              borderColor: focused ? colors.text : 'transparent',
              paddingVertical: s(4),
              paddingLeft: s(4),
              paddingRight: s(18),
            }}
          >
            <Avatar name={name} colour={colour} size={36} />
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: s(18), color: colors.text }}>{name}</Text>
          </View>
        );
      }}
    </Pressable>
  );
}

/** Before anyone has trained: the advice a first-timer needs. */
const FIRST_ADVICE = "go slow on the way down — I'll do the counting.";

export function HomeScreen({
  sessions,
  onStart,
  profileName,
  profileColour,
  onProgress,
  onSwitch,
}: {
  sessions: SessionRecord[];
  onStart: () => void;
  /** Who's training; shown so a household always knows whose page this is. */
  profileName: string;
  profileColour: string;
  onProgress: () => void;
  onSwitch: () => void;
}) {
  const s = useScale();
  const streak = streakDays(sessions);
  const best = bestStreak(sessions);
  const last = sessions[sessions.length - 1];
  // Carry the coach's advice from the last coached move over to today.
  const advice = sentence(last?.nextTime ?? FIRST_ADVICE);
  const now = new Date();
  const lastLine = lastTime(last, now);
  // The trainer shows the move you did last, so Home feels like yours; squats before anything.
  const preview = moveById(last?.move) ?? MOVES[0]!;
  const freeLoop = useCallback(() => null, []);
  const week = weekView(sessions, now);
  const daysThisWeek = week.filter((d) => d.state === 'done').length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: s(36), paddingHorizontal: s(64), paddingBottom: s(36), gap: s(20) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Wordmark />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(24) }}>
          <Kicker size={16}>{formatToday(now)}</Kicker>
          <WhoChip name={profileName} colour={profileColour} onPress={onSwitch} />
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: s(44) }}>
        <View style={{ flex: 1, gap: s(14) }}>
          <Kicker color={colors.accent}>READY WHEN YOU ARE</Kicker>
          <Headline text="Let's move." size={92} />
          <Note size={20}>Squats, lunges, push-ups and more. With your phone's camera, I check every rep.</Note>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10), marginTop: s(6), marginLeft: -s(6) }}>
            <FocusButton label="Start session" onPress={onStart} play preferredFocus />
            <FocusButton label="Your progress" onPress={onProgress} variant="secondary" />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
            <View style={{ width: s(10), height: s(10), borderRadius: s(5), backgroundColor: streak > 0 ? colors.accent : colors.line }} />
            <Text style={{ fontFamily: fonts.sans, fontSize: s(17), color: colors.muted }}>
              {streak > 0 ? (
                <>
                  <Text style={{ fontFamily: fonts.sansBold, color: colors.text }}>
                    {streak} {streak === 1 ? 'day' : 'days'}
                  </Text>{' '}
                  in a row · best run {best}
                </>
              ) : best > 0 ? (
                `Start a new streak today · best run ${best}`
              ) : (
                'Your first session starts your streak'
              )}
            </Text>
          </View>
        </View>

        <View style={{ width: s(500), gap: s(12) }}>
          <View style={{ height: s(270), borderRadius: s(18), backgroundColor: colors.surface, overflow: 'hidden' }}>
            {TRAINER_CLIPS[preview.id] !== undefined ? <TrainerVideo key={preview.id} clip={TRAINER_CLIPS[preview.id]!} paused={false} position={freeLoop} /> : null}
            <View style={{ position: 'absolute', left: s(14), bottom: s(12) }}>
              <PanelTag>{preview.name.toUpperCase()}</PanelTag>
            </View>
          </View>
          {/* The coach's advice from last time carries over to today. */}
          <View style={{ flexDirection: 'row', gap: s(12), alignItems: 'flex-start', paddingHorizontal: s(4) }}>
            <View style={{ marginTop: s(2) }}>
              <Speaker size={s(20)} />
            </View>
            <View style={{ flex: 1, gap: s(2) }}>
              <Text style={{ fontFamily: fonts.sansSemi, fontSize: s(17), lineHeight: s(23), color: colors.text }} numberOfLines={2}>
                {advice}
              </Text>
              {lastLine ? <Text style={{ fontFamily: fonts.sans, fontSize: s(15), color: colors.faint }}>{lastLine}</Text> : null}
            </View>
          </View>
        </View>
      </View>

      <View style={{ marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: s(28) }}>
        <View style={{ gap: s(10) }}>
          <Kicker>THIS WEEK</Kicker>
          <WeekStrip week={week} size={30} />
        </View>
        <Text style={{ fontFamily: fonts.sansBold, fontSize: s(19), color: colors.text, flexShrink: 1 }}>
          {daysThisWeek === 0 ? 'Nothing yet this week — one move is enough to start.' : `${daysThisWeek} ${daysThisWeek === 1 ? 'day' : 'days'} this week.`}
        </Text>
      </View>
    </View>
  );
}

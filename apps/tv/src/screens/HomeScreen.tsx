import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';
import { FocusButton } from '../components/FocusButton';
import { Avatar } from '../components/Avatar';
import { Card, PanelTag, Speaker } from '../components/Studio';
import { TrainerVideo } from '../components/TrainerVideo';
import { Headline, Kicker, Note, Wordmark } from '../components/Type';
import { bestStreak } from '../progress';
import { streakDays, type SessionRecord } from '../storage';
import { colors, fonts, useScale } from '../theme';
import { TRAINER_CLIPS } from '../trainerClips';
import { isFocused } from '../tv';
import { estimateSeconds, type Session, type Step } from '../workouts';

function amount(step: Step): string {
  return step.kind === 'reps' ? `${step.sets} × ${step.reps}` : `${step.seconds} s`;
}

function lastTime(record: SessionRecord | undefined, now: Date): string | null {
  if (!record) return null;
  const at = new Date(record.at);
  const day = at.toDateString() === now.toDateString() ? 'earlier today' : at.toLocaleDateString('en-GB', { weekday: 'long' });
  const clean = record.mode === 'coach' && record.cleanReps !== undefined && record.reps > 0 ? `, ${Math.round((record.cleanReps / record.reps) * 100)}% clean` : '';
  return `Last time, ${day}: ${record.reps} reps${clean}`;
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

export function HomeScreen({
  today,
  sessions,
  swapCount,
  onStart,
  onSwap,
  onNoCamera,
  profileName,
  profileColour,
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
  profileColour: string;
  onProgress: () => void;
  onSwitch: () => void;
}) {
  const s = useScale();
  const minutes = Math.round(estimateSeconds(today) / 60);
  const coached = today.steps.some((step) => step.kind === 'reps' && step.engine);
  const streak = streakDays(sessions);
  const best = bestStreak(sessions);
  const last = sessions[sessions.length - 1];
  // Carry the coach's advice from the last coached session over to today.
  const advice = sentence(last?.nextTime ?? today.coachNote);
  const now = new Date();
  const lastLine = lastTime(last, now);
  // The trainer previews the first move that has reps to it: the heart of the session.
  const preview = today.steps.find((step) => step.kind === 'reps' && TRAINER_CLIPS[step.id] !== undefined);
  const freeLoop = useCallback(() => null, []);

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
        <View style={{ flex: 1, gap: s(12) }}>
          <Kicker color={colors.accent}>
            TODAY · {minutes} MIN{coached ? ' · CAMERA COACHED' : ''}
            {swapCount > 0 ? ` · ${swapCount} SWAPPED` : ''}
          </Kicker>
          <Headline text={`${today.title}${today.titleItalic}`} size={80} />
          <Note size={19}>{today.summary}</Note>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10), marginTop: s(4), marginLeft: -s(6) }}>
            <FocusButton label="Start session" onPress={onStart} play preferredFocus />
            <FocusButton label="Follow along" onPress={onNoCamera} variant="secondary" />
            <FocusButton label="Swap a move" onPress={onSwap} variant="quiet" />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(20), marginLeft: -s(6) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), paddingLeft: s(6) }}>
              <View style={{ width: s(10), height: s(10), borderRadius: s(5), backgroundColor: streak > 0 ? colors.accent : colors.line }} />
              <Text style={{ fontFamily: fonts.sans, fontSize: s(17), color: colors.muted }}>
                <Text style={{ fontFamily: fonts.sansBold, color: colors.text }}>
                  {streak} {streak === 1 ? 'day' : 'days'}
                </Text>{' '}
                in a row · best run {best}
              </Text>
            </View>
            <FocusButton label="Progress" onPress={onProgress} variant="quiet" size="compact" />
          </View>
        </View>

        <View style={{ width: s(500), gap: s(12) }}>
          <View style={{ height: s(270), borderRadius: s(18), backgroundColor: colors.surface, overflow: 'hidden' }}>
            {preview ? <TrainerVideo key={preview.id} clip={TRAINER_CLIPS[preview.id]!} paused={false} position={freeLoop} /> : null}
            {preview ? (
              <View style={{ position: 'absolute', left: s(14), bottom: s(12) }}>
                <PanelTag>{preview.name.toUpperCase()}</PanelTag>
              </View>
            ) : null}
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

      <View style={{ gap: s(12), marginTop: 'auto' }}>
        <Kicker>TODAY'S MOVES</Kicker>
        <View style={{ flexDirection: 'row', gap: s(14) }}>
          {today.steps.map((step, i) => (
            <Card key={step.id} style={{ flex: 1, borderRadius: s(12), paddingVertical: s(12), paddingHorizontal: s(16), gap: s(4) }}>
              <Text style={{ fontFamily: fonts.sansBold, fontSize: s(13), color: colors.faint }}>{String(i + 1).padStart(2, '0')}</Text>
              <Text style={{ fontFamily: fonts.displaySemi, fontSize: s(20), color: colors.text }} numberOfLines={1}>
                {step.name}
              </Text>
              <Text style={{ fontFamily: fonts.sans, fontSize: s(15), color: colors.muted }}>{amount(step)}</Text>
            </Card>
          ))}
        </View>
      </View>
    </View>
  );
}

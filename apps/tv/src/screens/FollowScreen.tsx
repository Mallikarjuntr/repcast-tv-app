import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { FocusButton } from '../components/FocusButton';
import { BeatBar, DemoFigure } from '../components/DemoFigure';
import { CoachCard, Card, PanelTag, PausedOverlay, Segments } from '../components/Studio';
import { TrainerVideo, type TrainerPosition } from '../components/TrainerVideo';
import { REST_CLIP, TRAINER_CLIPS } from '../trainerClips';
import { BigNumber, Kicker, Note } from '../components/Type';
import { colors, fonts, useScale } from '../theme';
import { useTVEventHandler, type TVRemoteEvent } from '../tv';
import { useGuidedWorkout } from '../useGuidedWorkout';
import type { Session } from '../workouts';

function formatTime(seconds: number): string {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export interface FollowResult {
  reps: number;
  seconds: number;
}

/** Core mode: a follow-along workout with no camera — the beat counts the reps. */
export function FollowScreen({
  session,
  onFinish,
  finalLine,
}: {
  session: Session;
  onFinish: (result: FollowResult) => void;
  /** Said at the end instead of "That's the session" (e.g. when a coached session continues). */
  finalLine?: string;
}) {
  const s = useScale();
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [panel, setPanel] = useState({ width: 0, height: 0 });
  const w = useGuidedWorkout(session, paused, finalLine);
  const finished = useRef(false);

  // Remote keys only reach the app while a button has focus; Android sends down + up per press.
  const onRemote = useCallback((evt: TVRemoteEvent) => {
    if (evt.eventKeyAction === 0) return;
    if (evt.eventType === 'playPause') setPaused((p) => !p);
    else if (evt.eventType === 'pause') setPaused(true);
    else if (evt.eventType === 'play') setPaused(false);
  }, []);
  useTVEventHandler(onRemote);

  useEffect(() => {
    if (paused || w.phase === 'done') return;
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, [paused, w.phase]);

  useEffect(() => {
    if (w.phase === 'done' && !finished.current) {
      finished.current = true;
      onFinish({ reps: w.totalReps, seconds: elapsed });
    }
  }, [w.phase, w.totalReps, elapsed, onFinish]);

  const step = w.step;
  const resting = w.phase === 'rest';
  const sets = step.kind === 'reps' ? step.sets : 1;
  // While resting the trainer stands at ease; the next move is named on a card, not performed.
  const shown = step;
  const upcoming = resting ? w.upcoming : null;
  const { motion } = w;
  const position = useCallback(() => {
    if (resting) return (Math.sin((Date.now() / 3000) * Math.PI * 2) + 1) / 2;
    if (step.kind === 'reps') return motion().depth;
    return step.cycle > 0 ? (Math.sin((motion().timedElapsed / step.cycle) * Math.PI * 2) + 1) / 2 : 0;
  }, [motion, resting, step]);
  const holdStill = !resting && step.kind === 'timed' && step.cycle === 0;
  // The 3D trainer when this move has a clip; it waits during the intro, then follows the beat.
  const clip = resting ? REST_CLIP : TRAINER_CLIPS[shown.id];
  const trainerPosition = useCallback((): TrainerPosition => {
    if (resting) return null;
    const { beat } = motion();
    return beat === 'lead-in' ? 'hold' : beat;
  }, [motion, resting]);
  const depth = useCallback(() => motion().depth, [motion]);
  const onBeat = step.kind === 'reps' && w.phase === 'work';
  const coach =
    w.phase === 'rest'
      ? `Breathe. Next: ${w.nextLabel ?? 'the finish'}.`
      : step.kind === 'reps'
        ? w.half === 'down'
          ? step.cues.down
          : step.cues.up
        : step.cue;

  const steps = session.steps;
  const moveLabel = steps.length > 1 ? `MOVE ${w.stepIndex + 1} OF ${steps.length}` : '';
  const setLabel = !resting && sets > 1 ? `SET ${w.setIndex + 1} OF ${sets}` : '';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: s(40), paddingHorizontal: s(64), paddingBottom: s(36), gap: s(22) }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: s(54) }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: s(18) }}>
          <Text style={{ fontFamily: fonts.display, fontSize: s(30), color: colors.text }}>{resting ? 'REST' : step.name.toUpperCase()}</Text>
          <Kicker size={16}>{[moveLabel, setLabel].filter(Boolean).join(' · ')}</Kicker>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(14) }}>
          <Text style={{ fontFamily: fonts.sansBold, fontSize: s(26), color: colors.text, fontVariant: ['tabular-nums'], marginRight: s(8) }}>{formatTime(elapsed)}</Text>
          {w.phase === 'work' ? (
            <>
              <FocusButton label={paused ? 'Resume' : 'Pause'} onPress={() => setPaused((p) => !p)} variant="light" size="compact" preferredFocus />
              <FocusButton label="Done with this" onPress={w.finishSet} variant="secondary" size="compact" />
            </>
          ) : null}
        </View>
      </View>

      <View style={{ flex: 1, flexDirection: 'row', gap: s(40) }}>
        <View
          style={{ flex: 1, backgroundColor: colors.surface, borderRadius: s(20), overflow: 'hidden' }}
          onLayout={(e) => setPanel({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
        >
          {clip !== undefined ? (
            <>
              <TrainerVideo key={resting ? 'rest' : `${shown.id}-live`} clip={clip} paused={paused} position={trainerPosition} />
              {onBeat ? <BeatBar position={depth} animate={!paused} /> : null}
            </>
          ) : (
            <DemoFigure
              key={shown.id}
              demo={shown.demo}
              position={position}
              width={panel.width}
              height={panel.height}
              animate={!holdStill && !paused}
              depthBar={onBeat}
            />
          )}
          <View style={{ position: 'absolute', top: s(16), left: s(18) }}>
            <PanelTag>{resting ? 'THE TRAINER IS RESTING TOO' : 'LIKE THIS'}</PanelTag>
          </View>
          {upcoming ? (
            <Card style={{ position: 'absolute', left: s(16), right: s(16), bottom: s(16), backgroundColor: colors.bg, borderRadius: s(14), paddingVertical: s(14), paddingHorizontal: s(20), gap: s(4) }}>
              <Kicker size={13} color={colors.accent}>
                UP NEXT
              </Kicker>
              <Text style={{ fontFamily: fonts.display, fontSize: s(30), color: colors.text }}>{w.nextLabel ?? upcoming.name}</Text>
              <Text style={{ fontFamily: fonts.sans, fontSize: s(16), color: colors.muted }} numberOfLines={1}>
                {upcoming.why}
              </Text>
            </Card>
          ) : null}
        </View>

        <View style={{ width: s(380), gap: s(18) }}>
          {resting ? (
            <>
              <Kicker color={colors.accent}>REST · BREATHE</Kicker>
              <BigNumber value={String(w.secondsLeft).padStart(2, '0')} suffix="seconds" size={230} />
              <View style={{ flexDirection: 'row', marginLeft: -s(6) }}>
                <FocusButton label="Skip rest" onPress={w.skipRest} preferredFocus />
              </View>
            </>
          ) : step.kind === 'reps' ? (
            <>
              <Kicker color={colors.accent}>FOLLOW THE BEAT</Kicker>
              <BigNumber value={String(w.reps).padStart(2, '0')} suffix={`/ ${step.reps}`} size={230} />
              <Segments done={w.reps} total={step.reps} />
              {w.phase === 'work' ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(14) }}>
                  <Text style={{ fontFamily: fonts.display, fontSize: s(26), color: w.half === 'down' ? colors.accent : colors.dim }}>DOWN</Text>
                  <View style={{ flex: 1, height: s(4), borderRadius: s(2), backgroundColor: colors.line }} />
                  <Text style={{ fontFamily: fonts.display, fontSize: s(26), color: w.half === 'up' ? colors.accent : colors.dim }}>UP</Text>
                </View>
              ) : null}
            </>
          ) : (
            <>
              <Kicker color={colors.accent}>{holdStill ? 'HOLD IT' : 'KEEP GOING'}</Kicker>
              <BigNumber value={String(w.secondsLeft).padStart(2, '0')} suffix="seconds" size={230} />
              <Note size={17} color={colors.muted}>
                of {step.seconds}
              </Note>
            </>
          )}
          <View style={{ marginTop: 'auto' }}>
            <CoachCard line={coach} />
          </View>
        </View>
      </View>

      {steps.length > 1 ? (
        <View style={{ flexDirection: 'row', gap: s(6) }}>
          {steps.map((item, i) => (
            <View key={item.id} style={{ flex: 1, gap: s(6) }}>
              <View style={{ height: s(5), borderRadius: s(3), backgroundColor: i < w.stepIndex ? colors.faint : i === w.stepIndex ? colors.accent : colors.line }} />
              <Text style={{ fontFamily: fonts.sansBold, fontSize: s(13), color: i === w.stepIndex ? colors.text : colors.faint }} numberOfLines={1}>
                {item.name}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {paused ? <PausedOverlay /> : null}
    </View>
  );
}

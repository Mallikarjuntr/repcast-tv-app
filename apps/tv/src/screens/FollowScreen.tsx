import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { FocusButton } from '../components/FocusButton';
import { SetDot } from '../components/Marks';
import { BeatBar, DemoFigure } from '../components/DemoFigure';
import { TrainerVideo, type TrainerPosition } from '../components/TrainerVideo';
import { REST_CLIP, TRAINER_CLIPS } from '../trainerClips';
import { Tally } from '../components/Tally';
import { Headline, Kicker, PenNote } from '../components/Type';
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper, paddingTop: s(40), paddingHorizontal: s(64), paddingBottom: s(36), gap: s(20) }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Kicker size={18} color={colors.ink}>
          FOLLOW ALONG · {resting ? 'REST' : step.name.toUpperCase()}
          {!resting && sets > 1 ? ` · SET ${w.setIndex + 1} OF ${sets}` : ''}
        </Kicker>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(24) }}>
          <Text style={{ fontFamily: fonts.monoMedium, fontSize: s(28), color: colors.ink }}>{formatTime(elapsed)}</Text>
          {w.phase === 'work' ? (
            <>
              <FocusButton label={paused ? 'Resume' : 'Pause'} onPress={() => setPaused((p) => !p)} variant="link" fontSize={18} preferredFocus />
              <FocusButton label="Done with this" onPress={w.finishSet} variant="link" fontSize={18} />
            </>
          ) : null}
        </View>
      </View>

      <View style={{ flex: 1, flexDirection: 'row', gap: s(56), alignItems: 'center' }}>
        <View style={{ flex: 1.15, gap: s(12) }}>
          {w.phase === 'rest' ? (
            <View style={{ gap: s(14) }}>
              <Kicker>REST · NEXT: {(w.nextLabel ?? '').toUpperCase()}</Kicker>
              <Text style={{ fontFamily: fonts.displayBold, fontSize: s(300), lineHeight: s(260), letterSpacing: -s(14), color: colors.ink }}>
                {String(w.secondsLeft).padStart(2, '0')}
              </Text>
              <View style={{ flexDirection: 'row' }}>
                <FocusButton label="Skip rest" onPress={w.skipRest} preferredFocus fontSize={22} />
              </View>
            </View>
          ) : step.kind === 'reps' ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: s(18) }}>
                <Text style={{ fontFamily: fonts.displayBold, fontSize: s(340), lineHeight: s(290), letterSpacing: -s(17), color: colors.ink }}>
                  {String(w.reps).padStart(2, '0')}
                </Text>
                <Text style={{ fontFamily: fonts.displayItalic, fontSize: s(48), color: colors.pencil }}>of {step.reps}</Text>
              </View>
              <Tally done={w.reps} total={step.reps} height={s(52)} />
            </>
          ) : (
            <View style={{ gap: s(6) }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: s(18) }}>
                <Text style={{ fontFamily: fonts.displayBold, fontSize: s(300), lineHeight: s(260), letterSpacing: -s(14), color: colors.ink }}>
                  {String(w.secondsLeft).padStart(2, '0')}
                </Text>
                <Text style={{ fontFamily: fonts.displayItalic, fontSize: s(48), color: colors.pencil }}>seconds</Text>
              </View>
              <Kicker>OF {step.seconds} · KEEP GOING</Kicker>
            </View>
          )}
        </View>

        <View
          style={{ flex: 1, alignSelf: 'stretch', backgroundColor: colors.paperDeep, borderWidth: s(1.5), borderColor: colors.ink }}
          onLayout={(e) => setPanel({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
        >
          <View style={{ position: 'absolute', top: s(14), left: s(18), right: s(18), flexDirection: 'row', justifyContent: 'space-between', zIndex: 2 }}>
            <Kicker size={14}>{resting ? 'REST · BREATHE' : step.kind === 'reps' ? 'FOLLOW THE BEAT' : 'LIKE THIS'}</Kicker>
            {step.kind === 'reps' && w.phase === 'work' ? (
              <Text style={{ fontFamily: fonts.hand, fontSize: s(30), lineHeight: s(40), color: w.half === 'down' ? colors.pen : colors.ink }}>
                {w.half === 'down' ? 'down…' : 'up!'}
              </Text>
            ) : null}
          </View>
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
          {upcoming ? (
            <View style={{ position: 'absolute', left: s(18), right: s(18), bottom: s(18), backgroundColor: colors.paper, borderWidth: s(1.5), borderColor: colors.ink, paddingHorizontal: s(18), paddingVertical: s(12), gap: s(4), zIndex: 2 }}>
              <Kicker size={14}>UP NEXT</Kicker>
              <Text style={{ fontFamily: fonts.display, fontSize: s(30), color: colors.ink }}>{upcoming.name}</Text>
              <Text style={{ fontFamily: fonts.sans, fontSize: s(17), color: colors.inkSoft }}>{upcoming.why}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={{ borderTopWidth: s(1.5), borderTopColor: colors.ink, paddingTop: s(18), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: s(40) }}>
        <Text style={{ fontFamily: fonts.displayItalic, fontSize: s(36), lineHeight: s(42), color: colors.ink, flexShrink: 1 }}>“{coach}”</Text>
        <View style={{ flexDirection: 'row', gap: s(12) }}>
          {sets > 1 && Array.from({ length: sets }, (_, i) => (
            <SetDot key={i} size={s(26)} state={i < w.setIndex || (resting && i === w.setIndex) ? 'done' : i === w.setIndex ? 'current' : 'upcoming'} />
          ))}
        </View>
      </View>

      {paused ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(239,232,218,0.94)', alignItems: 'center', justifyContent: 'center', gap: s(18) }}>
          <Headline lead="Paused." size={120} />
          <PenNote arrow={false}>press OK or play/pause to carry on</PenNote>
        </View>
      ) : null}
    </View>
  );
}

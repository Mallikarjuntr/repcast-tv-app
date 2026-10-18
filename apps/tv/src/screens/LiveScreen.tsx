import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { FocusButton } from '../components/FocusButton';
import { LiveVideo } from '../components/LiveVideo';
import { PoseFigure, type Annotations, type PoseFrame } from '../components/PoseFigure';
import { CoachCard, PanelTag, PausedOverlay, PrivacyLine, Segments } from '../components/Studio';
import { BigNumber, Kicker, Note } from '../components/Type';
import { colors, fonts, useScale } from '../theme';
import { useTVEventHandler, type TVRemoteEvent } from '../tv';
import { useLiveWorkout, type RepNote, type WorkoutPlan } from '../useLiveWorkout';
import { latestOf } from '../poseFeed';
import { useSpokenGuidance } from '../useSpokenGuidance';
import { useVideoReceiver } from '../useVideoReceiver';
import { hush, say } from '../voice';
import { coachIntroLine, countLine, FINISH_LINE, HINT_LINES, NO_REP_LINE, restLine, setIntroLine } from '../voiceLines';

/** A live set's state, as the phone needs it. */
export interface LiveState {
  phase: 'work' | 'rest' | 'paused' | 'done';
  set: number;
  sets: number;
  count: number;
  target: number;
  secondsLeft?: number;
  next?: string;
}

/** How long the coach's marks stay on the outline after a rep. */
const NOTE_MS = 4000;
const PRAISE = ['Good depth.', 'Nice and steady.', "That's it — smooth."];

function coachLine(plan: WorkoutPlan, phase: string, rep: RepNote | null): string {
  if (phase === 'rest') return 'Good set. Breathe — shake out your legs.';
  if (!rep) return `Start your ${plan.name.toLowerCase()} when you're ready.`;
  if (!rep.counted) return `No rep — ${rep.cues[0] ?? "that one doesn't count"}.`;
  if (rep.cues.length > 0) return `${rep.cues[0]}.`;
  const left = plan.reps - rep.count;
  if (left <= 0) return "That's the set!";
  if (left <= 3) return `Strong. ${left} more.`;
  return PRAISE[rep.count % PRAISE.length]!;
}

function formatTime(seconds: number): string {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

/** How long without an outline before we say the phone has lost sight of you. */
const LOST_SIGHT_MS = 2500;

/**
 * The live outline. It subscribes to outlines itself and redraws on each one (about 12 a second),
 * so the rest of the live screen doesn't re-render with every frame.
 */
const LivePose = memo(function LivePose({
  getPose,
  subscribePose,
  notes,
  width,
  height,
}: {
  getPose: () => { frame: PoseFrame; at: number } | null;
  subscribePose: (listener: () => void) => () => void;
  notes: Annotations;
  width: number;
  height: number;
}) {
  const [, setTick] = useState(0);
  useEffect(() => subscribePose(() => setTick((t) => (t + 1) % 1_000_000)), [subscribePose]);
  // Re-check now and then, so a phone that stops sending is noticed even with no new outlines.
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => (t + 1) % 1_000_000), 1000);
    return () => clearInterval(timer);
  }, []);

  const latest = getPose();
  const lostSight = latest !== null && Date.now() - latest.at > LOST_SIGHT_MS;
  if (latest && !lostSight) return <PoseFigure frame={latest.frame} notes={notes} width={width} height={height} />;
  return <PoseWaiting lostSight={lostSight} />;
});

function PoseWaiting({ lostSight }: { lostSight: boolean }) {
  const s = useScale();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: s(24) }}>
      <Note size={24}>{lostSight ? "I can't see you — step back into view" : 'Waiting for the camera…'}</Note>
    </View>
  );
}

export function LiveScreen({
  channel,
  plan,
  next = null,
  onFinish,
  onState,
}: {
  channel: string;
  plan: WorkoutPlan;
  /** The next move's name in a multi-move session; null when this is the last. */
  next?: string | null;
  onFinish: (history: RepNote[], seconds: number) => void;
  /** Where the set is, for the phone to follow (the TV's count is the one that counts). */
  onState?: (state: LiveState) => void;
}) {
  const s = useScale();
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [panel, setPanel] = useState({ width: 0, height: 0 });
  const w = useLiveWorkout(channel, plan, paused);
  const video = useVideoReceiver(channel);
  // The phone's picture with the skeleton on it; the drawn outline stands in whenever it drops.
  const showVideo = video.state === 'connected' && video.streamUrl !== null && panel.width > 0;
  const { getPose, subscribePose } = w;
  const videoPose = useMemo(() => latestOf(video.pose, { getPose, subscribePose }), [video.pose, getPose, subscribePose]);
  const finished = useRef(false);

  // Remote keys only reach the app while something on screen has focus, which the Pause
  // button below provides. Android reports each press twice (down = 0, up = 1); act on release.
  const onRemote = useCallback((evt: TVRemoteEvent) => {
    if (evt.eventKeyAction === 0) return;
    if (evt.eventType === 'playPause') setPaused((p) => !p);
    else if (evt.eventType === 'pause') setPaused(true);
    else if (evt.eventType === 'play') setPaused(false);
  }, []);
  useTVEventHandler(onRemote);

  // The coach's voice, on the TV. Counts and verdicts come from the phone's engine; the lines are
  // pre-recorded (tools/voice). A fix follows its count ("seven … push your knees out").
  useEffect(() => {
    say(coachIntroLine(plan.name, plan.reps));
    return () => hush();
  }, [plan.name, plan.reps]);
  useEffect(() => {
    const rep = w.lastRep;
    if (!rep) return;
    if (!rep.counted) {
      say(NO_REP_LINE);
      if (rep.cues[0]) say(rep.cues[0], { after: true });
    } else {
      say(countLine(rep.count));
      if (rep.cues[0]) say(rep.cues[0], { after: true });
    }
  }, [w.lastRep]);
  useEffect(() => {
    if (w.phase === 'rest') say(restLine(w.restBeforeNextMove && next ? next : `set ${w.setIndex + 2}`), { after: true });
    else if (w.phase === 'done' && !next) say(FINISH_LINE, { after: true });
    else if (w.setIndex > 0) say(setIntroLine({ kind: 'reps', reps: plan.reps, cues: { start: '' } }, w.setIndex));
  }, [w.phase, w.setIndex, w.restBeforeNextMove, next, plan.reps]);
  useEffect(() => {
    if (paused) hush();
  }, [paused]);
  useSpokenGuidance(w.hint ? HINT_LINES[w.hint] : null, w.phase === 'work' && !paused);

  const nextUp = w.phase === 'rest' ? (w.restBeforeNextMove && next ? next : `${plan.name}, set ${w.setIndex + 2}`) : undefined;
  useEffect(() => {
    onState?.({
      phase: w.phase === 'work' && paused ? 'paused' : w.phase,
      set: w.setIndex + 1,
      sets: plan.sets,
      count: w.repsInSet,
      target: plan.reps,
      secondsLeft: w.phase === 'rest' ? w.restLeftSeconds : undefined,
      next: nextUp,
    });
  }, [onState, w.phase, paused, w.setIndex, plan.sets, w.repsInSet, plan.reps, w.restLeftSeconds, nextUp]);

  useEffect(() => {
    if (paused || w.phase === 'done') return;
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, [paused, w.phase]);

  const finishEarly = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    hush();
    // A copy: the live history keeps growing if a rep lands in the moment after this.
    onFinish([...w.history], elapsed);
  }, [elapsed, onFinish, w.history]);

  useEffect(() => {
    if (w.phase === 'done' && !finished.current) {
      finished.current = true;
      onFinish([...w.history], elapsed);
    }
  }, [w.phase, w.history, elapsed, onFinish]);

  const recent = w.lastRep && Date.now() - w.lastRep.at < NOTE_MS ? w.lastRep : null;
  const depthNote = recent?.depthOk === false;
  const kneesNote = recent?.faults.includes('knees-caving') ?? false;
  const chestNote = recent?.faults.includes('chest-dropping') ?? false;
  const notes: Annotations = useMemo(() => ({ depth: depthNote, knees: kneesNote, chest: chestNote }), [depthNote, kneesNote, chestNote]);
  const hasCorrection = !!recent && recent.verdict !== 'good';
  const noRep = !!recent && !recent.counted;

  // This set so far, as the phone judged it.
  const thisSet = w.history.filter((n) => n.set === w.setIndex);
  const clean = thisSet.filter((n) => n.counted && n.verdict === 'good').length;
  const withNote = thisSet.filter((n) => n.counted && n.verdict !== 'good').length;
  const missed = thisSet.filter((n) => !n.counted).length;
  const resting = w.phase === 'rest';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: s(40), paddingHorizontal: s(64), paddingBottom: s(40), gap: s(22) }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: s(54) }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: s(18) }}>
          <Text style={{ fontFamily: fonts.display, fontSize: s(30), color: colors.text }}>{plan.name}</Text>
          <Kicker size={16}>
            SET {w.setIndex + 1} OF {plan.sets}
          </Kicker>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(14) }}>
          <Text style={{ fontFamily: fonts.sansBold, fontSize: s(26), color: colors.text, fontVariant: ['tabular-nums'], marginRight: s(8) }}>{formatTime(elapsed)}</Text>
          {w.phase === 'work' ? <FocusButton label={paused ? 'Resume' : 'Pause'} onPress={() => setPaused((p) => !p)} variant="light" size="compact" preferredFocus /> : null}
          {/* Ends the move, rests included (camera trouble, or enough for today); what was done still counts. */}
          {w.phase !== 'done' ? <FocusButton label="Done with this" onPress={finishEarly} variant="secondary" size="compact" /> : null}
        </View>
      </View>

      <View style={{ flex: 1, flexDirection: 'row', gap: s(40) }}>
        <View style={{ width: s(380), gap: s(18) }}>
          {resting ? (
            <>
              <Kicker color={colors.accent}>{w.restBeforeNextMove && next ? `REST · NEXT: ${next.toUpperCase()}` : `REST · NEXT IS SET ${w.setIndex + 2} OF ${plan.sets}`}</Kicker>
              <BigNumber value={String(w.restLeftSeconds).padStart(2, '0')} suffix="seconds" size={230} />
              <View style={{ flexDirection: 'row', marginLeft: -s(6) }}>
                <FocusButton label="Skip rest" onPress={w.skipRest} preferredFocus />
              </View>
            </>
          ) : (
            <>
              <BigNumber value={String(w.repsInSet).padStart(2, '0')} suffix={`/ ${plan.reps}`} size={230} />
              <Segments done={w.repsInSet} total={plan.reps} />
              <Text style={{ fontFamily: fonts.sans, fontSize: s(17), color: colors.muted }}>
                <Text style={{ fontFamily: fonts.sansBold, color: colors.text }}>{clean}</Text> clean{'   '}
                <Text style={{ fontFamily: fonts.sansBold, color: colors.text }}>{withNote}</Text> with a note{'   '}
                <Text style={{ fontFamily: fonts.sansBold, color: missed > 0 ? colors.fault : colors.text }}>{missed}</Text> no rep
              </Text>
            </>
          )}
          <View style={{ marginTop: 'auto' }}>
            <CoachCard line={coachLine(plan, w.phase, w.lastRep)} correction={hasCorrection} />
          </View>
        </View>

        <View
          style={{ flex: 1, backgroundColor: colors.surface, borderRadius: s(20), overflow: 'hidden' }}
          onLayout={(e) => setPanel({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
        >
          {showVideo ? (
            <LiveVideo streamUrl={video.streamUrl!} getPose={videoPose.getPose} subscribePose={videoPose.subscribePose} notes={notes} width={panel.width} height={panel.height} />
          ) : (
            <LivePose getPose={w.getPose} subscribePose={w.subscribePose} notes={notes} width={panel.width} height={panel.height} />
          )}
          <View style={{ position: 'absolute', top: s(16), left: s(18) }}>
            <PanelTag dot={showVideo ? colors.live : undefined}>{showVideo ? 'YOU · LIVE' : 'YOU, RIGHT NOW'}</PanelTag>
          </View>
          {noRep ? (
            <View style={{ position: 'absolute', top: s(16), right: s(18), backgroundColor: colors.bg, borderRadius: s(8), borderWidth: s(3), borderColor: colors.fault, paddingHorizontal: s(14), paddingVertical: s(5) }}>
              <Text style={{ fontFamily: fonts.display, fontSize: s(28), letterSpacing: s(2), color: colors.fault }}>NO REP</Text>
            </View>
          ) : null}
          <View style={{ position: 'absolute', left: s(18), bottom: s(14) }}>
            <PrivacyLine color={colors.textSoft} />
          </View>
        </View>
      </View>

      {paused ? <PausedOverlay /> : null}
    </View>
  );
}

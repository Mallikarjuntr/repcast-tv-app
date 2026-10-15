import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { FocusButton } from '../components/FocusButton';
import { LiveVideo } from '../components/LiveVideo';
import { SetDot } from '../components/Marks';
import { PoseFigure, type Annotations, type PoseFrame } from '../components/PoseFigure';
import { Tally } from '../components/Tally';
import { Headline, Kicker, PenNote } from '../components/Type';
import { colors, fonts, useScale } from '../theme';
import { useTVEventHandler, type TVRemoteEvent } from '../tv';
import { useLiveWorkout, type RepNote, type WorkoutPlan } from '../useLiveWorkout';
import { latestOf } from '../poseFeed';
import { useSpokenGuidance } from '../useSpokenGuidance';
import { useVideoReceiver } from '../useVideoReceiver';
import { hush, say } from '../voice';
import { coachIntroLine, countLine, FINISH_LINE, HINT_LINES, NO_REP_LINE, restLine, setIntroLine } from '../voiceLines';

/** How long the coach's red-pen marks stay on the outline after a rep. */
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

function Lock({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={5} y={11} width={14} height={10} rx={2} fill="none" stroke={color} strokeWidth={2} />
      <Path d="M8 11 V7 a4 4 0 0 1 8 0 V11" fill="none" stroke={color} strokeWidth={2} />
    </Svg>
  );
}

function Speaker({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 9 H8 L13 5 V19 L8 15 H4 Z" fill="none" stroke={colors.ink} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M16.5 8.5 C 18 10, 18 14, 16.5 15.5 M19 6 C 22 9, 22 15, 19 18" fill="none" stroke={colors.ink} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
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
      <PenNote arrow={false} size={26}>
        {lostSight ? "I can't see you — step back into view" : 'waiting for the camera…'}
      </PenNote>
    </View>
  );
}

export function LiveScreen({
  channel,
  plan,
  next = null,
  onFinish,
}: {
  channel: string;
  plan: WorkoutPlan;
  /** The next move's name in a multi-move session; null when this is the last. */
  next?: string | null;
  onFinish: (history: RepNote[], seconds: number) => void;
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

  useEffect(() => {
    if (paused || w.phase === 'done') return;
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, [paused, w.phase]);

  useEffect(() => {
    if (w.phase === 'done' && !finished.current) {
      finished.current = true;
      onFinish(w.history, elapsed);
    }
  }, [w.phase, w.history, elapsed, onFinish]);

  const recent = w.lastRep && Date.now() - w.lastRep.at < NOTE_MS ? w.lastRep : null;
  const depthNote = recent?.depthOk === false;
  const kneesNote = recent?.faults.includes('knees-caving') ?? false;
  const chestNote = recent?.faults.includes('chest-dropping') ?? false;
  const notes: Annotations = useMemo(() => ({ depth: depthNote, knees: kneesNote, chest: chestNote }), [depthNote, kneesNote, chestNote]);
  const hasCorrection = !!recent && recent.verdict !== 'good';
  const noRep = !!recent && !recent.counted;

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper, paddingTop: s(40), paddingHorizontal: s(64), paddingBottom: s(36), gap: s(20) }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Kicker size={18} color={colors.ink}>
          {plan.name.toUpperCase()} · SET {w.setIndex + 1} OF {plan.sets}
        </Kicker>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(28) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
            <Lock size={s(18)} color={colors.pencil} />
            <Text style={{ fontFamily: fonts.sans, fontSize: s(16), color: colors.pencil }}>Video goes only from your phone to your TV — never to the cloud</Text>
          </View>
          <Text style={{ fontFamily: fonts.monoMedium, fontSize: s(28), color: colors.ink }}>{formatTime(elapsed)}</Text>
          {w.phase === 'work' ? (
            <FocusButton label={paused ? 'Resume' : 'Pause'} onPress={() => setPaused((p) => !p)} variant="link" fontSize={18} preferredFocus />
          ) : null}
        </View>
      </View>

      <View style={{ flex: 1, flexDirection: 'row', gap: s(56), alignItems: 'center' }}>
        <View style={{ flex: 1.15, gap: s(12) }}>
          {w.phase === 'rest' ? (
            <View style={{ gap: s(14) }}>
              <Kicker>{w.restBeforeNextMove && next ? `REST · NEXT: ${next.toUpperCase()}` : `REST · NEXT IS SET ${w.setIndex + 2} OF ${plan.sets}`}</Kicker>
              <Text style={{ fontFamily: fonts.displayBold, fontSize: s(300), lineHeight: s(260), letterSpacing: -s(14), color: colors.ink }}>
                {String(w.restLeftSeconds).padStart(2, '0')}
              </Text>
              <View style={{ flexDirection: 'row' }}>
                <FocusButton label="Skip rest" onPress={w.skipRest} preferredFocus fontSize={22} />
              </View>
            </View>
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: s(18) }}>
                <Text style={{ fontFamily: fonts.displayBold, fontSize: s(340), lineHeight: s(290), letterSpacing: -s(17), color: colors.ink }}>
                  {String(w.repsInSet).padStart(2, '0')}
                </Text>
                <Text style={{ fontFamily: fonts.displayItalic, fontSize: s(48), color: colors.pencil }}>of {plan.reps}</Text>
              </View>
              <Tally done={w.repsInSet} total={plan.reps} height={s(52)} />
            </>
          )}
        </View>

        <View
          style={{ flex: 1, alignSelf: 'stretch', backgroundColor: colors.paperDeep, borderWidth: s(1.5), borderColor: colors.ink }}
          onLayout={(e) => setPanel({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
        >
          {showVideo ? (
            <LiveVideo streamUrl={video.streamUrl!} getPose={videoPose.getPose} subscribePose={videoPose.subscribePose} notes={notes} width={panel.width - s(3)} height={panel.height - s(3)} />
          ) : null}
          <View style={{ position: 'absolute', top: s(14), left: s(18), zIndex: 2, backgroundColor: showVideo ? colors.paper : 'transparent', paddingHorizontal: showVideo ? s(8) : 0, paddingVertical: showVideo ? s(3) : 0 }}>
            <Kicker size={14}>YOU, RIGHT NOW</Kicker>
          </View>
          {noRep ? (
            <View style={{ position: 'absolute', top: s(36), right: s(22), borderWidth: s(3), borderColor: colors.pen, paddingHorizontal: s(14), paddingVertical: s(4), transform: [{ rotate: '-8deg' }], zIndex: 2, backgroundColor: showVideo ? colors.paper : 'transparent' }}>
              <Text style={{ fontFamily: fonts.monoMedium, fontSize: s(26), letterSpacing: s(4), color: colors.pen }}>NO REP</Text>
            </View>
          ) : null}
          {showVideo ? null : <LivePose getPose={w.getPose} subscribePose={w.subscribePose} notes={notes} width={panel.width} height={panel.height} />}
        </View>
      </View>

      <View style={{ borderTopWidth: s(1.5), borderTopColor: colors.ink, paddingTop: s(18), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: s(40) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(20), flexShrink: 1 }}>
          <Speaker size={s(34)} />
          <Text style={{ fontFamily: fonts.displayItalic, fontSize: s(36), lineHeight: s(42), color: hasCorrection ? colors.pen : colors.ink, flexShrink: 1 }}>
            “{coachLine(plan, w.phase, w.lastRep)}”
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: s(12) }}>
          {Array.from({ length: plan.sets }, (_, i) => (
            <SetDot key={i} size={s(26)} state={i < w.setIndex ? 'done' : i === w.setIndex ? 'current' : 'upcoming'} />
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

import { useCallback, useEffect, useRef, useState } from 'react';
import { hush, say } from './voice';
import { countLine, FINISH_LINE, restLine, setIntroLine } from './voiceLines';
import type { Session, Step } from './workouts';

/** How often the workout checks for rep, set and phase boundaries. Cheap: it only sets state on change. */
const CHECK_MS = 50;
/** Time for the coach's intro before the beat starts: a new move's intro is longer than "Set 2. 12 reps." */
const LEAD_IN_MS = { firstSet: 4500, laterSet: 2500 };

export type GuidedPhase = 'work' | 'rest' | 'done';

export interface Motion {
  depth: number;
  timedElapsed: number;
  beat: number | 'lead-in' | null;
}

export interface GuidedWorkout {
  step: Step;
  stepIndex: number;
  setIndex: number;
  phase: GuidedPhase;
  /** Reps counted by the beat in the current set. */
  reps: number;
  /** Which half of the beat we're in. */
  half: 'down' | 'up';
  /** Whole seconds left in a timed step or a rest. */
  secondsLeft: number;
  nextLabel: string | null;
  /** The move that runs after the current set or rest (the same move when sets remain). */
  upcoming: Step | null;
  totalReps: number;
  /**
   * Where the demo is right now: `depth` 0 standing → 1 at the bottom of a rep, seconds into a timed
   * step, and seconds into the current beat ('lead-in' while the intro plays, null off the beat).
   * Read it every animation frame; it isn't React state, so reading it re-renders nothing.
   */
  motion: () => Motion;
  finishSet: () => void;
  skipRest: () => void;
}

function ease(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

/**
 * Runs a follow-along session with no camera: reps are counted by the tempo beat, timed moves count
 * down, rests come between sets. Pausing freezes everything.
 *
 * The clock lives in refs rather than state, so the screen re-renders only when something visible
 * changes (a rep, a second, a phase) instead of ten times a second — on a Fire TV Stick that was
 * the difference between a smooth and a stuttering workout.
 */
export function useGuidedWorkout(session: Session, paused: boolean): GuidedWorkout {
  const [stepIndex, setStepIndex] = useState(0);
  const [setIndex, setSetIndex] = useState(0);
  const [phase, setPhaseState] = useState<GuidedPhase>('work');
  const [reps, setRepsState] = useState(0);
  // Mirrors of phase and reps that update immediately, so the 50 ms checker never acts twice on
  // the same boundary before React has re-rendered.
  const phaseRef = useRef<GuidedPhase>('work');
  const repsRef = useRef(0);
  const setPhase = useCallback((p: GuidedPhase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);
  const setReps = useCallback((n: number) => {
    repsRef.current = n;
    setRepsState(n);
  }, []);
  const [half, setHalfState] = useState<'down' | 'up'>('down');
  const [secondsLeft, setSecondsLeftState] = useState(0);
  // The checker runs every 50 ms; only touch React state when the shown value actually changes,
  // or React may re-render the whole screen for nothing.
  const halfRef = useRef<'down' | 'up'>('down');
  const secondsRef = useRef(0);
  const setHalf = useCallback((h: 'down' | 'up') => {
    if (halfRef.current === h) return;
    halfRef.current = h;
    setHalfState(h);
  }, []);
  const setSecondsLeft = useCallback((n: number) => {
    if (secondsRef.current === n) return;
    secondsRef.current = n;
    setSecondsLeftState(n);
  }, []);
  const totalReps = useRef(0);
  const restMs = useRef(0);
  const step = session.steps[stepIndex]!;

  // A pausable stopwatch for the current phase (a set, a timed move or a rest).
  const phaseAcc = useRef(0);
  const runningSince = useRef<number | null>(paused ? null : Date.now());
  const pausedRef = useRef(paused);
  const elapsed = useCallback(() => phaseAcc.current + (runningSince.current === null ? 0 : Date.now() - runningSince.current), []);
  /** Start the phase's stopwatch; a lead-in starts it below zero so the beat waits for the intro. */
  const restartClock = useCallback((leadInMs = 0) => {
    phaseAcc.current = -leadInMs;
    runningSince.current = pausedRef.current ? null : Date.now();
  }, []);

  useEffect(() => {
    pausedRef.current = paused;
    if (paused && runningSince.current !== null) {
      phaseAcc.current += Date.now() - runningSince.current;
      runningSince.current = null;
      hush();
    } else if (!paused && runningSince.current === null) {
      runningSince.current = Date.now();
    }
  }, [paused]);

  const introduce = useCallback((s: Step, set: number) => {
    say(s.kind === 'reps' ? setIntroLine(s, set) : s.cue);
  }, []);

  const startStep = useCallback(
    (index: number, set: number) => {
      const s = session.steps[index]!;
      restartClock(s.kind === 'reps' ? (set === 0 ? LEAD_IN_MS.firstSet : LEAD_IN_MS.laterSet) : 0);
      setStepIndex(index);
      setSetIndex(set);
      setReps(0);
      setHalf('down');
      setSecondsLeft(s.kind === 'timed' ? s.seconds : 0);
      setPhase('work');
      introduce(s, set);
    },
    [introduce, restartClock, session.steps, setHalf, setPhase, setReps, setSecondsLeft],
  );

  const endSet = useCallback(() => {
    if (phaseRef.current !== 'work') return;
    const s = session.steps[stepIndex]!;
    const moreSets = s.kind === 'reps' && setIndex + 1 < s.sets;
    if (!moreSets && stepIndex + 1 >= session.steps.length) {
      setPhase('done');
      say(FINISH_LINE);
      return;
    }
    restMs.current = (s.kind === 'reps' ? s.restSeconds : 10) * 1000;
    restartClock();
    setSecondsLeft(Math.ceil(restMs.current / 1000));
    setPhase('rest');
    say(restLine(moreSets ? `set ${setIndex + 2}` : session.steps[stepIndex + 1]!.name));
  }, [restartClock, session.steps, setIndex, setPhase, setSecondsLeft, stepIndex]);

  const advance = useCallback(() => {
    const s = session.steps[stepIndex]!;
    if (s.kind === 'reps' && setIndex + 1 < s.sets) startStep(stepIndex, setIndex + 1);
    else startStep(stepIndex + 1, 0);
  }, [session.steps, setIndex, startStep, stepIndex]);

  // Say the first move once, and start its countdown.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const first = session.steps[0]!;
    if (first.kind === 'timed') setSecondsLeft(first.seconds);
    else restartClock(LEAD_IN_MS.firstSet);
    introduce(first, 0);
  }, [introduce, restartClock, session.steps, setSecondsLeft]);

  useEffect(() => () => hush(), []);

  useEffect(() => {
    if (phase === 'done') return;
    const timer = setInterval(() => {
      const ms = elapsed();
      if (phaseRef.current === 'done') return;
      if (phaseRef.current === 'rest') {
        const left = restMs.current - ms;
        if (left <= 0) advance();
        else setSecondsLeft(Math.ceil(left / 1000));
        return;
      }
      const s = session.steps[stepIndex]!;
      if (s.kind === 'reps') {
        const downMs = s.beat.down * 1000;
        const beatMs = downMs + s.beat.up * 1000;
        if (ms < 0) return; // still in the lead-in
        const done = Math.min(Math.floor(ms / beatMs), s.reps);
        setHalf(ms % beatMs < downMs ? 'down' : 'up');
        if (done > repsRef.current) {
          totalReps.current += done - repsRef.current;
          setReps(done);
          say(countLine(done));
          if (done >= s.reps) endSet();
        }
      } else {
        const left = s.seconds * 1000 - ms;
        if (left <= 0) endSet();
        else setSecondsLeft(Math.ceil(left / 1000));
      }
    }, CHECK_MS);
    return () => clearInterval(timer);
  }, [advance, elapsed, endSet, phase, session.steps, setHalf, setReps, setSecondsLeft, stepIndex]);

  const motion = useCallback((): Motion => {
    const ms = elapsed();
    const s = session.steps[stepIndex]!;
    if (phase !== 'work') return { depth: 0, timedElapsed: 0, beat: null };
    if (s.kind === 'timed') return { depth: 0, timedElapsed: ms / 1000, beat: null };
    if (ms < 0) return { depth: 0, timedElapsed: 0, beat: 'lead-in' };
    const downMs = s.beat.down * 1000;
    const upMs = s.beat.up * 1000;
    const within = ms % (downMs + upMs);
    const depth = within < downMs ? ease(within / downMs) : 1 - ease((within - downMs) / upMs);
    return { depth, timedElapsed: 0, beat: within / 1000 };
  }, [elapsed, phase, session.steps, stepIndex]);

  const finishSet = useCallback(() => {
    if (phase === 'work') endSet();
  }, [endSet, phase]);

  const moreSets = step.kind === 'reps' && setIndex + 1 < step.sets;
  return {
    step,
    stepIndex,
    setIndex,
    phase,
    reps,
    half,
    secondsLeft,
    nextLabel: moreSets ? `${step.name}, set ${setIndex + 2}` : (session.steps[stepIndex + 1]?.name ?? null),
    upcoming: moreSets ? step : (session.steps[stepIndex + 1] ?? null),
    totalReps: totalReps.current,
    motion,
    finishSet,
    skipRest: advance,
  };
}

import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session, Step } from './workouts';

const TICK_MS = 100;
const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];

export type GuidedPhase = 'work' | 'rest' | 'done';

export interface GuidedWorkout {
  step: Step;
  stepIndex: number;
  setIndex: number;
  phase: GuidedPhase;
  /** Reps counted by the beat in the current set. */
  reps: number;
  /** Where the current rep is: 0 standing → 1 at the bottom → back to 0. */
  depth: number;
  /** Which half of the beat we're in. */
  half: 'down' | 'up';
  /** Seconds left in a timed step or a rest. */
  secondsLeft: number;
  /** Seconds of a timed step done so far (drives its demo). */
  timedElapsed: number;
  nextLabel: string | null;
  /** The move that runs after the current set or rest (the same move when sets remain). */
  upcoming: Step | null;
  totalReps: number;
  finishSet: () => void;
  skipRest: () => void;
}

function say(text: string): void {
  Speech.stop().catch(() => {});
  Speech.speak(text, { language: 'en-IN', rate: 1.0 });
}

function ease(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

/**
 * Runs a follow-along session with no camera: reps are counted by the tempo beat, timed moves count
 * down, rests come between sets. Pausing freezes everything.
 */
export function useGuidedWorkout(session: Session, paused: boolean): GuidedWorkout {
  const [stepIndex, setStepIndex] = useState(0);
  const [setIndex, setSetIndex] = useState(0);
  const [phase, setPhase] = useState<GuidedPhase>('work');
  const [, setTick] = useState(0);
  const activeMs = useRef(0);
  const restMs = useRef(0);
  const lastReps = useRef(0);
  const totalReps = useRef(0);
  const step = session.steps[stepIndex]!;

  const introduce = useCallback((s: Step, set: number) => {
    if (s.kind === 'reps') say(set === 0 ? s.cues.start : `Set ${set + 1}. ${s.reps} reps.`);
    else say(s.cue);
  }, []);

  const startStep = useCallback(
    (index: number, set: number) => {
      activeMs.current = 0;
      lastReps.current = 0;
      setStepIndex(index);
      setSetIndex(set);
      setPhase('work');
      introduce(session.steps[index]!, set);
    },
    [introduce, session.steps],
  );

  const endSet = useCallback(() => {
    const s = session.steps[stepIndex]!;
    const moreSets = s.kind === 'reps' && setIndex + 1 < s.sets;
    const isLast = stepIndex + 1 >= session.steps.length;
    if (!moreSets && isLast) {
      setPhase('done');
      say("That's the session. Well done.");
      return;
    }
    const rest = s.kind === 'reps' ? s.restSeconds : 10;
    restMs.current = rest * 1000;
    setPhase('rest');
    const next = moreSets ? `set ${setIndex + 2}` : session.steps[stepIndex + 1]!.name.toLowerCase();
    say(`Rest. Next, ${next}.`);
  }, [session.steps, setIndex, stepIndex]);

  const advance = useCallback(() => {
    const s = session.steps[stepIndex]!;
    if (s.kind === 'reps' && setIndex + 1 < s.sets) startStep(stepIndex, setIndex + 1);
    else startStep(stepIndex + 1, 0);
  }, [session.steps, setIndex, startStep, stepIndex]);

  // Say the first move once.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    introduce(session.steps[0]!, 0);
  }, [introduce, session.steps]);

  useEffect(() => {
    if (paused) Speech.stop().catch(() => {});
  }, [paused]);

  useEffect(() => () => void Speech.stop().catch(() => {}), []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (paused || phase === 'done') return;
      if (phase === 'rest') {
        restMs.current -= TICK_MS;
        if (restMs.current <= 0) advance();
        setTick((t) => t + 1);
        return;
      }
      activeMs.current += TICK_MS;
      const s = session.steps[stepIndex]!;
      if (s.kind === 'reps') {
        const beatMs = (s.beat.down + s.beat.up) * 1000;
        const reps = Math.floor(activeMs.current / beatMs);
        if (reps > lastReps.current) {
          lastReps.current = reps;
          totalReps.current += 1;
          say(NUMBER_WORDS[reps] ?? String(reps));
          if (reps >= s.reps) endSet();
        }
      } else if (activeMs.current >= s.seconds * 1000) {
        endSet();
      }
      setTick((t) => t + 1);
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [advance, endSet, paused, phase, session.steps, stepIndex]);

  const finishSet = useCallback(() => {
    if (phase === 'work') endSet();
  }, [endSet, phase]);

  let depth = 0;
  let half: 'down' | 'up' = 'down';
  if (step.kind === 'reps' && phase === 'work') {
    const downMs = step.beat.down * 1000;
    const beatMs = downMs + step.beat.up * 1000;
    const within = activeMs.current % beatMs;
    half = within < downMs ? 'down' : 'up';
    depth = half === 'down' ? ease(within / downMs) : 1 - ease((within - downMs) / (step.beat.up * 1000));
  }

  const moreSets = step.kind === 'reps' && setIndex + 1 < step.sets;
  const nextStep = moreSets ? `${step.name}, set ${setIndex + 2}` : (session.steps[stepIndex + 1]?.name ?? null);
  const upcoming = moreSets ? step : (session.steps[stepIndex + 1] ?? null);

  return {
    step,
    stepIndex,
    setIndex,
    phase,
    reps: lastReps.current,
    depth,
    half,
    secondsLeft: phase === 'rest' ? Math.max(0, Math.ceil(restMs.current / 1000)) : step.kind === 'timed' ? Math.max(0, Math.ceil(step.seconds - activeMs.current / 1000)) : 0,
    timedElapsed: activeMs.current / 1000,
    nextLabel: nextStep,
    upcoming,
    totalReps: totalReps.current,
    finishSet,
    skipRest: advance,
  };
}

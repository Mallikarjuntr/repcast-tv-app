import { subscribe, type LiveStatus } from '@spotter/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PoseFrame } from './components/PoseFigure';

export interface WorkoutPlan {
  exercise: string;
  name: string;
  sets: number;
  reps: number;
  restSeconds: number;
}

export interface RepNote {
  /** Which set (0-based) the attempt was in. */
  set: number;
  /** Counted reps in the set after this attempt. */
  count: number;
  counted: boolean;
  verdict: 'good' | 'fix' | 'no-rep';
  depthOk: boolean | null;
  faults: string[];
  cues: string[];
  /** When the TV received it (ms). */
  at: number;
}

export type Phase = 'work' | 'rest' | 'done';

export interface LiveWorkout {
  phase: Phase;
  setIndex: number;
  repsInSet: number;
  totalReps: number;
  lastRep: RepNote | null;
  /**
   * The latest outline and when it arrived. Outlines come about 12 times a second, so they are not
   * React state: a panel subscribes and redraws itself, and the rest of the screen stays still.
   */
  getPose: () => { frame: PoseFrame; at: number } | null;
  subscribePose: (listener: () => void) => () => void;
  restLeftSeconds: number;
  live: LiveStatus;
  skipRest: () => void;
  /** Every attempt, counted or not, for the summary. */
  history: RepNote[];
}

/**
 * Runs a set-based workout from the phone's live events: counts reps per set, starts rests,
 * and finishes after the last set. Reps arriving while paused or resting are ignored.
 */
export function useLiveWorkout(channel: string, plan: WorkoutPlan, paused: boolean): LiveWorkout {
  const [phase, setPhase] = useState<Phase>('work');
  const [setIndex, setSetIndex] = useState(0);
  const [repsInSet, setRepsInSet] = useState(0);
  const [lastRep, setLastRep] = useState<RepNote | null>(null);
  const [live, setLive] = useState<LiveStatus>('connecting');
  const [restEndsAt, setRestEndsAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const pose = useRef<{ frame: PoseFrame; at: number } | null>(null);
  const poseListeners = useRef(new Set<() => void>());
  const history = useRef<RepNote[]>([]);
  const repsRef = useRef(0);
  const state = useRef({ phase, setIndex, paused });
  state.current = { phase, setIndex, paused };

  useEffect(() => {
    const sub = subscribe(
      channel,
      (event) => {
        if (event.type === 'pose') {
          pose.current = { frame: { p: event.p, aspect: event.aspect, mirrored: event.mirrored }, at: Date.now() };
          poseListeners.current.forEach((listener) => listener());
        } else if (event.type === 'rep') {
          const s = state.current;
          if (s.phase !== 'work' || s.paused) return;
          // Older phones send no `counted` flag; treat those as counted.
          const counted = event.counted ?? true;
          if (counted) {
            repsRef.current += 1;
            setRepsInSet(repsRef.current);
          }
          const note: RepNote = {
            set: s.setIndex,
            count: repsRef.current,
            counted,
            verdict: event.verdict ?? 'good',
            depthOk: event.depthOk,
            faults: event.faults ?? [],
            cues: event.cues,
            at: Date.now(),
          };
          history.current.push(note);
          setLastRep(note);
          if (note.count >= plan.reps) {
            if (s.setIndex + 1 >= plan.sets) {
              setPhase('done');
            } else {
              setPhase('rest');
              setRestEndsAt(Date.now() + plan.restSeconds * 1000);
            }
          }
        }
      },
      setLive,
    );
    return () => sub.close();
  }, [channel, plan.reps, plan.sets, plan.restSeconds]);

  useEffect(() => {
    // Drives the rest countdown and how long the coach's marks stay up; a second's resolution is plenty.
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  const getPose = useCallback(() => pose.current, []);
  const subscribePose = useCallback((listener: () => void) => {
    poseListeners.current.add(listener);
    return () => {
      poseListeners.current.delete(listener);
    };
  }, []);

  const startNextSet = useCallback(() => {
    repsRef.current = 0;
    setRepsInSet(0);
    setSetIndex((i) => i + 1);
    setLastRep(null);
    setPhase('work');
  }, []);

  useEffect(() => {
    if (phase === 'rest' && now >= restEndsAt) startNextSet();
  }, [phase, now, restEndsAt, startNextSet]);

  return {
    phase,
    setIndex,
    repsInSet,
    totalReps: history.current.filter((n) => n.counted).length,
    lastRep,
    getPose,
    subscribePose,
    restLeftSeconds: Math.max(0, Math.ceil((restEndsAt - now) / 1000)),
    live,
    skipRest: startNextSet,
    history: history.current,
  };
}

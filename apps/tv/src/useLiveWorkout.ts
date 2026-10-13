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
  count: number;
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
  pose: PoseFrame | null;
  /** Milliseconds since the last outline arrived; large means the phone lost sight of you. */
  poseAgeMs: number;
  restLeftSeconds: number;
  live: LiveStatus;
  skipRest: () => void;
  /** Per-rep log for the summary. */
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
  const [pose, setPose] = useState<PoseFrame | null>(null);
  const [live, setLive] = useState<LiveStatus>('connecting');
  const [restEndsAt, setRestEndsAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const poseAt = useRef(0);
  const history = useRef<RepNote[]>([]);
  const repsRef = useRef(0);
  const state = useRef({ phase, setIndex, paused });
  state.current = { phase, setIndex, paused };

  useEffect(() => {
    const sub = subscribe(
      channel,
      (event) => {
        if (event.type === 'pose') {
          poseAt.current = Date.now();
          setPose({ p: event.p, aspect: event.aspect, mirrored: event.mirrored });
        } else if (event.type === 'rep') {
          const s = state.current;
          if (s.phase !== 'work' || s.paused) return;
          repsRef.current += 1;
          setRepsInSet(repsRef.current);
          const note = { count: repsRef.current, depthOk: event.depthOk, faults: event.faults ?? [], cues: event.cues, at: Date.now() };
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
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
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
    totalReps: history.current.length,
    lastRep,
    pose,
    poseAgeMs: poseAt.current ? now - poseAt.current : Infinity,
    restLeftSeconds: Math.max(0, Math.ceil((restEndsAt - now) / 1000)),
    live,
    skipRest: startNextSet,
    history: history.current,
  };
}

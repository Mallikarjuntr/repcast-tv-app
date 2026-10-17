import { useCallback, useMemo, useRef, useState } from 'react';
import type { MoveResult } from '../summary';
import { useExerciseCommand } from '../useExerciseCommand';
import type { WorkoutPlan } from '../useLiveWorkout';
import { useVideoReceiver } from '../useVideoReceiver';
import { judgedSteps, type Session } from '../workouts';
import { FollowScreen } from './FollowScreen';
import { LiveScreen, type LiveState } from './LiveScreen';

/** Rest between one judged move and the next. */
const REST_BETWEEN_MOVES_S = 20;

/**
 * A whole session with the camera: only the moves the camera can check, each on the live screen
 * with the phone's picture (no trainer videos — those belong to Follow along). Today it runs one move. The phone
 * is kept in step: it is told which exercise to judge and where the set is, and shows the TV's count.
 * Holds the video link for the whole session so it doesn't drop between moves.
 */
export function CoachSessionScreen({ channel, session, onFinish }: { channel: string; session: Session; onFinish: (moves: MoveResult[], seconds: number) => void }) {
  const steps = useMemo(() => judgedSteps(session), [session]);
  const [index, setIndex] = useState(0);
  const [live, setLive] = useState<LiveState | null>(null);
  const moves = useRef<MoveResult[]>([]);
  const startedAt = useRef(Date.now());
  useVideoReceiver(channel);

  const step = steps[index] ?? null;
  const nextStep = steps[index + 1] ?? null;
  useExerciseCommand(
    channel,
    step
      ? { id: step.engine, name: step.name, ...(live ?? { phase: 'work', set: 1, sets: step.sets, count: 0, target: step.reps }) }
      : { id: null, phase: 'done' },
    { endOnLeave: true },
  );

  const advance = useCallback(() => {
    setLive(null);
    if (index + 1 < steps.length) setIndex(index + 1);
    else onFinish(moves.current, Math.round((Date.now() - startedAt.current) / 1000));
  }, [index, onFinish, steps.length]);

  // A session with nothing the camera can check (a hold, say) is
  // simply followed along.
  if (!step) return <FollowScreen session={session} onFinish={() => onFinish([], Math.round((Date.now() - startedAt.current) / 1000))} />;

  const plan: WorkoutPlan = {
    exercise: step.engine,
    name: step.name,
    sets: step.sets,
    reps: step.reps,
    restSeconds: step.restSeconds,
    restAfter: nextStep ? REST_BETWEEN_MOVES_S : undefined,
  };
  return (
    <LiveScreen
      key={index}
      channel={channel}
      plan={plan}
      next={nextStep?.name ?? null}
      onState={setLive}
      onFinish={(history, seconds) => {
        moves.current.push({ plan, history, seconds });
        advance();
      }}
    />
  );
}

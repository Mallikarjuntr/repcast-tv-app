import { useCallback, useRef, useState } from 'react';
import type { MoveResult } from '../summary';
import { useExerciseCommand } from '../useExerciseCommand';
import type { WorkoutPlan } from '../useLiveWorkout';
import { useVideoReceiver } from '../useVideoReceiver';
import type { Session } from '../workouts';
import { FollowScreen } from './FollowScreen';
import { LiveScreen } from './LiveScreen';

/** Rest between one judged move and the next. */
const REST_BETWEEN_MOVES_S = 20;

/**
 * A whole session with the camera: moves the engine can judge run on the live screen (the phone is
 * told which exercise to judge), the rest — warm-ups, holds, stretches — run as follow-along with the
 * trainer. Holds the video link for the whole session so it doesn't drop between moves.
 */
export function CoachSessionScreen({ channel, session, onFinish }: { channel: string; session: Session; onFinish: (moves: MoveResult[], seconds: number) => void }) {
  const [index, setIndex] = useState(0);
  const moves = useRef<MoveResult[]>([]);
  const startedAt = useRef(Date.now());
  useVideoReceiver(channel);

  const step = session.steps[index]!;
  const nextStep = session.steps[index + 1] ?? null;
  const judged = step.kind === 'reps' && step.engine ? step.engine : null;
  useExerciseCommand(channel, judged);

  const advance = useCallback(() => {
    if (index + 1 < session.steps.length) setIndex(index + 1);
    else onFinish(moves.current, Math.round((Date.now() - startedAt.current) / 1000));
  }, [index, onFinish, session.steps.length]);

  if (judged && step.kind === 'reps') {
    const plan: WorkoutPlan = {
      exercise: judged,
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
        onFinish={(history, seconds) => {
          moves.current.push({ plan, history, seconds });
          advance();
        }}
      />
    );
  }
  // Mid-session, the next move's own intro follows straight away; only the last move says goodbye.
  return <FollowScreen key={index} session={{ ...session, steps: [step] }} finalLine={nextStep ? '' : undefined} onFinish={advance} />;
}

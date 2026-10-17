import { controlChannel, openChannel, type ExerciseCommand, type LiveChannel } from '@spotter/shared';
import { useEffect, useRef } from 'react';

/** Repeated this often, so a phone that (re)joins mid-session catches up within a couple of seconds. */
const HEARTBEAT_MS = 2000;

/** Time for the last "done" to leave before its socket closes. */
const CLOSE_AFTER_DONE_MS = 2000;

/** What the TV tells the phone: the exercise to judge and where the session is (see ExerciseCommand). */
export type CoachCommand = Omit<ExerciseCommand, 'type' | 'at'>;

/**
 * Keeps the phone in step with the TV: which exercise to judge, and the session's phase, set and
 * count, so the phone judges only during a set and shows the TV's count. One publish-only
 * connection; the command is sent whenever it changes and as a heartbeat.
 */
export function useExerciseCommand(sessionChannel: string | null, command: CoachCommand, { endOnLeave = false } = {}): void {
  const channel = useRef<LiveChannel | null>(null);
  const current = useRef(command);
  current.current = command;

  useEffect(() => {
    if (!sessionChannel) return;
    const send = () => channel.current?.send({ type: 'exercise', ...current.current, at: Date.now() }, true);
    channel.current = openChannel(controlChannel(sessionChannel), {
      onStatus: (status) => {
        if (status === 'live') send();
      },
    });
    const timer = setInterval(send, HEARTBEAT_MS);
    return () => {
      clearInterval(timer);
      // Leaving the session (finished, or BACK): tell the phone at once rather than letting it time out.
      // Said twice and the socket kept open a moment: in testing about one "done" in five sent just
      // before closing never reached the phone, which then showed "Lost your TV".
      const leaving = channel.current;
      channel.current = null;
      if (endOnLeave && leaving) {
        const done = () => leaving.send({ type: 'exercise', id: null, phase: 'done', at: Date.now() }, true);
        done();
        setTimeout(done, CLOSE_AFTER_DONE_MS / 2);
        setTimeout(() => leaving.close(), CLOSE_AFTER_DONE_MS);
      } else leaving?.close();
    };
  }, [sessionChannel]);

  // Compare by value: callers build a new object each render.
  const key = JSON.stringify(command);
  useEffect(() => {
    channel.current?.send({ type: 'exercise', ...current.current, at: Date.now() }, true);
  }, [key]);
}

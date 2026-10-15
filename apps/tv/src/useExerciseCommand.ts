import { controlChannel, openChannel, type LiveChannel } from '@spotter/shared';
import { useEffect, useRef } from 'react';

/** Repeated this often, so a phone that (re)joins mid-session learns what to judge. */
const HEARTBEAT_MS = 4000;

/**
 * Tells the phone which exercise to judge (an engine id such as "squat"), or null for moves the
 * camera doesn't judge. One publish-only connection for the whole session; the id is sent when it
 * changes and as a heartbeat.
 */
export function useExerciseCommand(sessionChannel: string, exerciseId: string | null): void {
  const channel = useRef<LiveChannel | null>(null);
  const current = useRef(exerciseId);
  current.current = exerciseId;

  useEffect(() => {
    const send = () => channel.current?.send({ type: 'exercise', id: current.current, at: Date.now() }, true);
    channel.current = openChannel(controlChannel(sessionChannel), {
      onStatus: (status) => {
        if (status === 'live') send();
      },
    });
    const timer = setInterval(send, HEARTBEAT_MS);
    return () => {
      clearInterval(timer);
      channel.current?.close();
      channel.current = null;
    };
  }, [sessionChannel]);

  useEffect(() => {
    channel.current?.send({ type: 'exercise', id: exerciseId, at: Date.now() }, true);
  }, [exerciseId]);
}

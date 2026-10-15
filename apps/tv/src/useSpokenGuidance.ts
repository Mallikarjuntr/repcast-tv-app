import { useEffect, useRef } from 'react';
import { say } from './voice';

/** An unresolved piece of advice is repeated this often, and never more than this many times. */
const REPEAT_MS = 15_000;
const MAX_REPEATS = 2;

/**
 * Speaks a line of guidance ("Step back a little.") when it appears or changes, after anything the
 * coach is already saying, and repeats it a couple of times while it still applies — clear help
 * without nagging. Pass null when there's nothing to say, and active=false to keep quiet (paused, resting).
 */
export function useSpokenGuidance(line: string | null, active: boolean): void {
  const repeats = useRef(0);

  useEffect(() => {
    repeats.current = 0;
    if (!line || !active) return;
    say(line, { after: true });
    const timer = setInterval(() => {
      if (repeats.current >= MAX_REPEATS) return;
      repeats.current += 1;
      say(line, { after: true });
    }, REPEAT_MS);
    return () => clearInterval(timer);
  }, [line, active]);
}

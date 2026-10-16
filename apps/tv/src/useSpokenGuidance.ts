import { useEffect, useRef } from 'react';
import { say } from './voice';

/** A line must stay the same this long before it's said, so a passing change is never spoken. */
const SETTLE_MS = 1500;
/** The same line isn't said again within this long, however often the advice comes and goes. */
const SAME_LINE_GAP_MS = 20_000;
/** An unresolved piece of advice is repeated this often, and never more than this many times. */
const REPEAT_MS = 15_000;
const MAX_REPEATS = 2;

/**
 * Speaks a line of guidance ("Step back a little.") once it has settled, after anything the coach is
 * already saying, and repeats it a couple of times while it still applies — clear help without
 * nagging. Pass null when there's nothing to say, and active=false to keep quiet (paused, resting).
 * `repeat` is for advice that needs acting on; a go-ahead ("I can see you") is said once.
 */
export function useSpokenGuidance(line: string | null, active: boolean, repeat = true): void {
  const lastSaid = useRef<{ line: string; at: number } | null>(null);

  useEffect(() => {
    if (!line || !active) return;
    let repeats = 0;
    const speak = () => {
      lastSaid.current = { line, at: Date.now() };
      say(line, { after: true });
    };
    let timer: ReturnType<typeof setInterval> | undefined;
    const again = repeat;
    const settle = setTimeout(() => {
      const recent = lastSaid.current;
      if (!recent || recent.line !== line || Date.now() - recent.at >= SAME_LINE_GAP_MS) speak();
      if (!again) return;
      timer = setInterval(() => {
        if (repeats >= MAX_REPEATS) return;
        repeats += 1;
        speak();
      }, REPEAT_MS);
    }, SETTLE_MS);
    return () => {
      clearTimeout(settle);
      clearInterval(timer);
    };
  }, [line, active, repeat]);
}

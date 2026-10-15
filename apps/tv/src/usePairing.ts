import { createSession, subscribe, type BodyPart, type LiveStatus, type Session } from '@spotter/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPoseFeed, type PoseFeed } from './poseFeed';

export type PairingState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | {
      phase: 'ready';
      session: Session;
      live: LiveStatus;
      phoneConnected: boolean;
      framing: Record<BodyPart, boolean> | null;
      sideOn: boolean;
    };

/** Creates a pairing session, listens on its channel and tracks the phone's connection and framing. */
export function usePairing(): { state: PairingState; newCode: () => void; pose: PoseFeed } {
  const [state, setState] = useState<PairingState>({ phase: 'loading' });
  const [attempt, setAttempt] = useState(0);
  // The phone's outline, for drawing over its video while the user gets into frame.
  const pose = useRef(createPoseFeed()).current;

  useEffect(() => {
    let cancelled = false;
    let close: (() => void) | undefined;
    setState({ phase: 'loading' });

    createSession()
      .then((session) => {
        if (cancelled) return;
        setState({ phase: 'ready', session, live: 'connecting', phoneConnected: false, framing: null, sideOn: false });
        const update = (fn: (s: Extract<PairingState, { phase: 'ready' }>) => Partial<Extract<PairingState, { phase: 'ready' }>>) =>
          setState((s) => (s.phase === 'ready' ? { ...s, ...fn(s) } : s));
        const sub = subscribe(
          session.channel,
          (event) => {
            if (event.type === 'pose') pose.push({ p: event.p, aspect: event.aspect, mirrored: event.mirrored });
            else if (event.type === 'hello') update(() => ({ phoneConnected: true }));
            else if (event.type === 'framing') update(() => ({ phoneConnected: true, framing: event.visible, sideOn: event.sideOn ?? false }));
            else if (event.type === 'bye') update(() => ({ phoneConnected: false, framing: null }));
          },
          (live) => update(() => ({ live })),
        );
        close = () => sub.close();
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ phase: 'error', message: err instanceof Error ? err.message : String(err) });
      });

    return () => {
      cancelled = true;
      close?.();
    };
  }, [attempt, pose]);

  const newCode = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, newCode, pose };
}

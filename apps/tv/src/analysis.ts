import { requestAnalysis, type AnalysisReport, type AnalysisRequest } from '@spotter/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SessionRecord } from './storage';
import type { RepNote } from './useLiveWorkout';

/** The backend gives up at 30 s; the TV waits a little longer so it hears the backend's answer. */
const TIMEOUT_MS = 35_000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** What the receipt knows about one camera workout, enough to ask for its analysis. */
export interface AnalysisSource {
  pairing: { code: string; channel: string };
  move: { id: string; name: string };
  plan: { sets: number; reps: number };
  seconds: number;
  history: RepNote[];
  /** ISO time the workout finished: earlier sessions are counted back from here. */
  at: string;
}

/**
 * The workout as numbers: every attempt's verdict, depth, pace and form notes, plus up to eight
 * earlier camera sessions of the same move on this TV. No names, video or body points.
 */
export function analysisRequest(source: AnalysisSource, sessions: SessionRecord[]): AnalysisRequest {
  const finished = new Date(source.at).getTime();
  const previous = sessions
    .filter((r) => r.mode === 'coach' && r.move === source.move.id && r.at < source.at)
    .slice(-8)
    .reverse()
    .map((r) => ({
      daysAgo: Math.max(0, Math.floor((finished - new Date(r.at).getTime()) / DAY_MS)),
      reps: r.reps,
      ...(r.cleanReps !== undefined ? { cleanReps: r.cleanReps } : {}),
      seconds: r.seconds,
    }));
  return {
    code: source.pairing.code,
    channel: source.pairing.channel,
    move: source.move,
    plan: source.plan,
    seconds: source.seconds,
    attempts: source.history.map((n) => ({
      set: n.set,
      verdict: n.verdict,
      counted: n.counted,
      faults: n.faults.slice(0, 6),
      ...(n.verdict !== 'good' && n.cues[0] ? { reason: n.cues[0].slice(0, 140) } : {}),
      ...(n.bottom !== undefined ? { bottomDeg: n.bottom } : {}),
      ...(n.durationMs !== undefined ? { durationMs: n.durationMs } : {}),
    })),
    previous,
  };
}

export type AnalysisState = { phase: 'writing' } | { phase: 'done'; report: AnalysisReport } | { phase: 'failed'; message: string };

/**
 * Asks once when the screen opens (or uses a report already written for this workout); `retry`
 * asks again. A finished report is handed to `onReport` so going back and forth doesn't re-ask.
 */
export function useAnalysis(request: AnalysisRequest, cached: AnalysisReport | undefined, onReport: (report: AnalysisReport) => void): { state: AnalysisState; retry: () => void } {
  const [state, setState] = useState<AnalysisState>(cached ? { phase: 'done', report: cached } : { phase: 'writing' });
  const [attempt, setAttempt] = useState(0);
  const report = useRef(onReport);
  report.current = onReport;

  useEffect(() => {
    if (cached && attempt === 0) return;
    let left = false;
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
    setState({ phase: 'writing' });
    requestAnalysis(request, abort.signal)
      .then((r) => {
        if (left) return;
        setState({ phase: 'done', report: r });
        report.current(r);
      })
      .catch((err: unknown) => {
        if (left) return;
        // A TypeError is fetch failing to connect; other errors carry the backend's own message.
        const message = abort.signal.aborted
          ? 'Your coach took too long to answer. Try again.'
          : err instanceof TypeError
            ? "Couldn't reach RepCast. Check the TV's internet and try again."
            : err instanceof Error
              ? err.message
              : String(err);
        setState({ phase: 'failed', message });
      })
      .finally(() => clearTimeout(timer));
    return () => {
      left = true;
      clearTimeout(timer);
      abort.abort();
    };
    // `request` is built once per workout; only a retry asks again.
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, retry };
}

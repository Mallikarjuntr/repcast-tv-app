import { config } from '@spotter/shared';
import { useEffect, useState } from 'react';
import { spotterNote, type CoachNote, type WorkoutSummary } from './summary';

const TIMEOUT_MS = 10000;

async function askAiCoach(summary: WorkoutSummary, signal: AbortSignal): Promise<CoachNote | null> {
  const res = await fetch(`${config.apiUrl}/coach-note`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(summary),
    signal,
  });
  if (!res.ok) return null;
  const body = (await res.json()) as Partial<CoachNote>;
  return body.note && body.nextTime ? { note: body.note, nextTime: body.nextTime, source: 'ai' } : null;
}

/**
 * The receipt's note: RepCast's own note straight away, replaced by the AI coach's when it
 * answers in time. Any failure just keeps RepCast's note — the receipt never waits or breaks.
 */
export function useCoachNote(summary: WorkoutSummary): { note: CoachNote; writing: boolean } {
  const [note, setNote] = useState<CoachNote>(() => spotterNote(summary));
  const [writing, setWriting] = useState<boolean>(config.aiCoach);

  useEffect(() => {
    if (!config.aiCoach) return;
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
    askAiCoach(summary, abort.signal)
      .then((ai) => ai && setNote(ai))
      .catch(() => {})
      .finally(() => {
        clearTimeout(timer);
        setWriting(false);
      });
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [summary]);

  return { note, writing };
}

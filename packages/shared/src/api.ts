import { config } from './config';

export interface Session {
  code: string;
  channel: string;
  /** Unix seconds. */
  expiresAt: number;
}

async function request(path: string, init?: RequestInit): Promise<Session> {
  const res = await fetch(`${config.apiUrl}${path}`, init);
  const body = (await res.json().catch(() => ({}))) as Partial<Session> & { error?: string };
  if (!res.ok || !body.code || !body.channel || !body.expiresAt) {
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return { code: body.code, channel: body.channel, expiresAt: body.expiresAt };
}

/**
 * A pairing code as shown on the TV: 6 digits (4 from older backends, still accepted so phones and
 * TVs keep working while the backend is updated).
 */
export function isPairingCode(code: string): boolean {
  return /^(\d{4}|\d{6})$/.test(code);
}

/** TV side: get a fresh pairing code and its channel. */
export function createSession(): Promise<Session> {
  return request('/sessions', { method: 'POST' });
}

/** Camera side: find the channel for the code shown on the TV. */
export function findSession(code: string): Promise<Session> {
  return request(`/sessions/${encodeURIComponent(code)}`);
}

/** The AI coach's report on one camera workout (a model on Amazon Bedrock, via POST /coach/analysis). */
export interface AnalysisReport {
  headline: string;
  coachNote: string;
  howItWent: string;
  numbers: { title: string; detail: string }[];
  comparedWithLastTime: string;
  nextSession: { plan: string; drill: string };
  /** Which model wrote it, e.g. "Amazon Nova" (older backends leave it out). */
  writtenBy?: string;
}

/** One attempt as sent for analysis: numbers only, no video or body points. */
export interface AnalysisAttempt {
  set: number;
  verdict: 'good' | 'fix' | 'no-rep';
  counted: boolean;
  faults: string[];
  reason?: string;
  bottomDeg?: number;
  durationMs?: number;
}

export interface AnalysisRequest {
  /** The live pairing session the workout ran on: the backend only answers those. */
  code: string;
  channel: string;
  move: { id: string; name: string };
  plan: { sets: number; reps: number };
  seconds: number;
  attempts: AnalysisAttempt[];
  /** Earlier sessions of the same move on this TV, newest first. */
  previous: { daysAgo: number; reps: number; cleanReps?: number; seconds: number }[];
}

/** TV side: ask the AI coach for a report. Rejects with the backend's own message when it can. */
export async function requestAnalysis(body: AnalysisRequest, signal?: AbortSignal): Promise<AnalysisReport> {
  const res = await fetch(`${config.apiUrl}/coach/analysis`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  const json = (await res.json().catch(() => ({}))) as { report?: AnalysisReport; error?: string };
  if (!res.ok || !json.report) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json.report;
}

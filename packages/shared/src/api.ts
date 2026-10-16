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

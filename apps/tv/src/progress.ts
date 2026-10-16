import type { SessionRecord } from './storage';

/** One calendar day of someone's training. */
export interface DayStat {
  date: Date;
  sessions: number;
  reps: number;
  minutes: number;
  isToday: boolean;
  isFuture: boolean;
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Whole weeks (Monday first) ending with this one, oldest first: a calendar to read at a glance,
 * with what each day held. Days after today are marked future.
 */
export function calendarWeeks(sessions: SessionRecord[], weeks: number, now = new Date()): DayStat[][] {
  const byDay = new Map<string, SessionRecord[]>();
  for (const s of sessions) {
    const key = dayKey(new Date(s.at));
    byDay.set(key, [...(byDay.get(key) ?? []), s]);
  }
  const today = startOfDay(now);
  const monday = new Date(today);
  monday.setDate(monday.getDate() - ((today.getDay() + 6) % 7) - 7 * (weeks - 1));
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + w * 7 + d);
      const held = byDay.get(dayKey(date)) ?? [];
      return {
        date,
        sessions: held.length,
        reps: held.reduce((n, s) => n + s.reps, 0),
        minutes: Math.round(held.reduce((n, s) => n + s.seconds, 0) / 60),
        isToday: date.getTime() === today.getTime(),
        isFuture: date.getTime() > today.getTime(),
      };
    }),
  );
}

/** The longest run of consecutive days with a workout, ever. */
export function bestStreak(sessions: SessionRecord[]): number {
  const days = [...new Set(sessions.map((s) => startOfDay(new Date(s.at)).getTime()))].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let previous: number | null = null;
  for (const day of days) {
    // Calendar days, not 24-hour gaps, so a clock change doesn't break a streak.
    const next = previous === null ? null : startOfDay(new Date(previous + 36 * 3600 * 1000)).getTime();
    run = next === day ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return best;
}

export interface Totals {
  sessions: number;
  reps: number;
  minutes: number;
  /** Sessions coached with the camera. */
  coached: number;
}

export function totals(sessions: SessionRecord[]): Totals {
  return {
    sessions: sessions.length,
    reps: sessions.reduce((n, s) => n + s.reps, 0),
    minutes: Math.round(sessions.reduce((n, s) => n + s.seconds, 0) / 60),
    coached: sessions.filter((s) => s.mode === 'coach').length,
  };
}

/** Clean-form percentage of the last few camera-coached sessions, oldest first. */
export function cleanTrend(sessions: SessionRecord[], count = 10): number[] {
  return sessions
    .filter((s) => s.mode === 'coach' && s.cleanReps !== undefined && s.reps > 0)
    .slice(-count)
    .map((s) => Math.round(((s.cleanReps ?? 0) / s.reps) * 100));
}

/** "Today", "Yesterday", "3 days ago", "12 Oct" — for the profile picker. */
export function lastSeen(sessions: SessionRecord[], now = new Date()): string | null {
  const last = sessions[sessions.length - 1];
  if (!last) return null;
  const days = Math.round((startOfDay(now).getTime() - startOfDay(new Date(last.at)).getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(last.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

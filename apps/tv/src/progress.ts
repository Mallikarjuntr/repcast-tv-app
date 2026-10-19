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

/** One square of the year grid. */
export interface YearDay {
  date: Date;
  reps: number;
  sessions: number;
  /** 0 = nothing; 1–4 = how much, by quartile of the person's own active days (as GitHub does). */
  level: 0 | 1 | 2 | 3 | 4;
  isToday: boolean;
  isFuture: boolean;
}

export interface YearGrid {
  /** Weeks, oldest first, each Monday to Sunday. */
  weeks: YearDay[][];
  /** Month name over the first week that starts in it, by week index. */
  months: { week: number; label: string }[];
  reps: number;
  activeDays: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A year of training, GitHub-calendar style: one square per day, darker for more reps. */
export function yearGrid(sessions: SessionRecord[], now = new Date(), weekCount = 53): YearGrid {
  const weeks = calendarWeeks(sessions, weekCount, now);
  const active = weeks.flat().filter((d) => d.sessions > 0);
  // Follow-along sessions without reps still count as a light day.
  const amounts = active.map((d) => Math.max(1, d.reps)).sort((a, b) => a - b);
  const q = (p: number) => amounts[Math.min(amounts.length - 1, Math.floor(p * amounts.length))] ?? 0;
  const [q1, q2, q3] = [q(0.25), q(0.5), q(0.75)];
  const level = (d: DayStat): YearDay['level'] => {
    if (d.sessions === 0) return 0;
    const n = Math.max(1, d.reps);
    return n <= q1 ? 1 : n <= q2 ? 2 : n <= q3 ? 3 : 4;
  };
  const months: YearGrid['months'] = [];
  weeks.forEach((week, i) => {
    const month = week[0]!.date.getMonth();
    if (i === 0 || month !== weeks[i - 1]![0]!.date.getMonth()) months.push({ week: i, label: MONTHS[month]! });
  });
  // The first label is usually a partial month squeezed against the next: drop it if so.
  if (months.length > 1 && months[1]!.week - months[0]!.week < 3) months.shift();
  return {
    weeks: weeks.map((week) => week.map((d) => ({ date: d.date, reps: d.reps, sessions: d.sessions, level: level(d), isToday: d.isToday, isFuture: d.isFuture }))),
    months,
    reps: active.reduce((n, d) => n + d.reps, 0),
    activeDays: active.length,
  };
}

/** Which moves someone trains most, by reps (sessions for moves without reps), for the last year. */
export function moveShare(sessions: SessionRecord[], now = new Date(), top = 5): { name: string; reps: number; share: number }[] {
  const since = now.getTime() - 365 * 86_400_000;
  const byMove = new Map<string, number>();
  for (const s of sessions) {
    if (new Date(s.at).getTime() < since) continue;
    byMove.set(s.title, (byMove.get(s.title) ?? 0) + Math.max(1, s.reps));
  }
  const total = [...byMove.values()].reduce((a, b) => a + b, 0);
  const sorted = [...byMove.entries()].sort((a, b) => b[1] - a[1]);
  const shown = sorted.slice(0, top).map(([name, reps]) => ({ name, reps, share: reps / total }));
  const rest = sorted.slice(top).reduce((n, [, reps]) => n + reps, 0);
  return rest > 0 ? [...shown, { name: 'Other', reps: rest, share: rest / total }] : shown;
}

import AsyncStorage from '@react-native-async-storage/async-storage';

/** One finished workout, kept on the TV for streaks and "last time". */
export interface SessionRecord {
  /** ISO timestamp of when it finished. */
  at: string;
  mode: 'core' | 'coach';
  title: string;
  reps: number;
  seconds: number;
  /** Coach mode only: reps that counted cleanly, out of `reps`. */
  cleanReps?: number;
  /** The coach's "next time" advice, shown on Home before the next session. */
  nextTime?: string;
}

const KEY = 'spotter.sessions.v1';
const KEEP = 120;

export async function loadSessions(): Promise<SessionRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SessionRecord[]) : [];
  } catch {
    return [];
  }
}

export async function saveSession(record: SessionRecord): Promise<SessionRecord[]> {
  const all = [...(await loadSessions()), record].slice(-KEEP);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Storage full or unavailable: progress just isn't remembered this time.
  }
  return all;
}

function startOfWeek(now: Date): Date {
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((now.getDay() + 6) % 7));
  return monday;
}

/** Smart coaching is free three times a week (Monday to Sunday). */
export function freeCoachSessionsLeft(sessions: SessionRecord[], now = new Date()): number {
  const monday = startOfWeek(now);
  const used = sessions.filter((s) => s.mode === 'coach' && new Date(s.at) >= monday).length;
  return Math.max(0, 3 - used);
}

export type DayState = 'done' | 'missed' | 'today' | 'ahead';

/** Monday-to-Sunday view of this week from real sessions. */
export function weekView(sessions: SessionRecord[], now = new Date()): { day: string; state: DayState }[] {
  const todayIndex = (now.getDay() + 6) % 7;
  const monday = startOfWeek(now);
  const doneDays = new Set(
    sessions
      .map((s) => new Date(s.at))
      .filter((d) => d >= monday)
      .map((d) => (d.getDay() + 6) % 7),
  );
  return ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => ({
    day,
    state: i === todayIndex ? (doneDays.has(i) ? 'done' : 'today') : i > todayIndex ? 'ahead' : doneDays.has(i) ? 'done' : 'missed',
  }));
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** Days in a row with a workout, counting back from today (or yesterday, if today isn't done yet). */
export function streakDays(sessions: SessionRecord[], now = new Date()): number {
  const days = new Set(sessions.map((s) => dayKey(new Date(s.at))));
  const day = new Date(now);
  if (!days.has(dayKey(day))) day.setDate(day.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(day))) {
    streak += 1;
    day.setDate(day.getDate() - 1);
  }
  return streak;
}

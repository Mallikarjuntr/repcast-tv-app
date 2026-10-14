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

export type DayState = 'done' | 'missed' | 'today' | 'ahead';

/** Monday-to-Sunday view of this week from real sessions. */
export function weekView(sessions: SessionRecord[], now = new Date()): { day: string; state: DayState }[] {
  const todayIndex = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - todayIndex);
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

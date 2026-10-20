import AsyncStorage from '@react-native-async-storage/async-storage';

/** One finished workout, kept on the TV for streaks and "last time". */
export interface SessionRecord {
  /** ISO timestamp of when it finished. */
  at: string;
  mode: 'core' | 'coach';
  /** The move's name (older records: the session's name). */
  title: string;
  /** The move's id, e.g. "squat" (older records, from whole sessions, have none). */
  move?: string;
  reps: number;
  seconds: number;
  /** Coach mode only: reps that counted cleanly, out of `reps`. */
  cleanReps?: number;
  /** The coach's "next time" advice, shown on Home before the next session. */
  nextTime?: string;
}

/** Someone who trains on this TV. Everything RepCast remembers is kept per person, on the TV only. */
export interface Profile {
  id: string;
  name: string;
  /** ISO timestamp. */
  createdAt: string;
}

export const MAX_PROFILES = 6;

/** Before profiles, one history and one set of swaps were kept for the whole TV under these keys. */
const LEGACY_SESSIONS_KEY = 'spotter.sessions.v1';
const LEGACY_SWAPS_KEY = 'spotter.swaps.v1';
const PROFILES_KEY = 'spotter.profiles.v1';
const LAST_PROFILE_KEY = 'spotter.lastProfile.v1';
const sessionsKey = (profileId: string) => `spotter.sessions.v1.${profileId}`;
// Swaps from the old fixed session; still migrated and kept, no longer read (moves are picked now).
const swapsKey = (profileId: string) => `spotter.swaps.v1.${profileId}`;
const KEEP = 365;

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable: it just isn't remembered this time.
  }
}

/**
 * The people who train on this TV. The first time, the TV's existing history and swaps become the
 * first profile ("Me"), so nothing is lost; the old keys are left in place untouched.
 */
export async function loadProfiles(): Promise<Profile[]> {
  const saved = await readJson<Profile[] | null>(PROFILES_KEY, null);
  if (saved && saved.length > 0) return saved;
  const first: Profile = { id: 'p1', name: 'Me', createdAt: new Date().toISOString() };
  await writeJson(sessionsKey(first.id), await readJson<SessionRecord[]>(LEGACY_SESSIONS_KEY, []));
  await writeJson(swapsKey(first.id), await readJson<Record<string, string>>(LEGACY_SWAPS_KEY, {}));
  await writeJson(PROFILES_KEY, [first]);
  return [first];
}

/** Adds someone new (with no history); returns everyone. */
export async function addProfile(name: string): Promise<Profile[]> {
  const profiles = await loadProfiles();
  if (profiles.length >= MAX_PROFILES) return profiles;
  const used = new Set(profiles.map((p) => p.id));
  let n = profiles.length + 1;
  while (used.has(`p${n}`)) n += 1;
  const next = [...profiles, { id: `p${n}`, name: name.trim().slice(0, 20), createdAt: new Date().toISOString() }];
  await writeJson(PROFILES_KEY, next);
  return next;
}

/** Who trained last, so the TV can start with them. */
export async function loadLastProfileId(): Promise<string | null> {
  return readJson<string | null>(LAST_PROFILE_KEY, null);
}

export async function saveLastProfileId(profileId: string): Promise<void> {
  await writeJson(LAST_PROFILE_KEY, profileId);
}

export async function loadSessions(profileId: string): Promise<SessionRecord[]> {
  return readJson<SessionRecord[]>(sessionsKey(profileId), []);
}

export async function saveSession(profileId: string, record: SessionRecord): Promise<SessionRecord[]> {
  const all = [...(await loadSessions(profileId)), record].slice(-KEEP);
  await writeJson(sessionsKey(profileId), all);
  return all;
}

function startOfWeek(now: Date): Date {
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((now.getDay() + 6) % 7));
  return monday;
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

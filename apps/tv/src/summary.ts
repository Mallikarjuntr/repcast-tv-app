import type { RepNote, WorkoutPlan } from './useLiveWorkout';

/** How the coach talks about each form check, in a sentence and as a fix. */
const FAULTS: Record<string, { said: string; fix: string }> = {
  'knees-caving': { said: 'knees drifted in', fix: 'knees pushed out over your toes' },
  'chest-dropping': { said: 'your chest dropped', fix: 'chest up the whole way down' },
  'hips-sagging': { said: 'your hips sagged', fix: 'squeeze your glutes to keep the line' },
  'hips-piking': { said: 'your hips piked up', fix: 'lower your hips into one straight line' },
  'hips-uneven': { said: 'your hips tilted', fix: 'keep both hips level' },
};

export interface SetSummary {
  /** e.g. "SQUATS · SET 1"; sets of a multi-move session say which move they were. */
  label: string;
  attempts: number;
  counted: number;
  good: number;
  noReps: number;
}

export interface FaultSummary {
  id: string;
  said: string;
  fix: string;
  /** Counted reps (numbered across the whole workout) that had this fault. */
  reps: number[];
}

/** What happened in a coached workout, worked out from every attempt the phone judged. */
export interface WorkoutSummary {
  exercise: string;
  name: string;
  plannedSets: number;
  plannedReps: number;
  /** Reps the whole session asked for (every set of every move). */
  plannedTotal: number;
  sets: SetSummary[];
  attempts: number;
  counted: number;
  good: number;
  noReps: number;
  /** Good reps out of counted reps, 0–100; null when nothing counted. */
  cleanPct: number | null;
  faults: FaultSummary[];
  /** Why attempts didn't count, most common first. */
  noRepReasons: { reason: string; count: number }[];
  seconds: number;
}

/** "Not deep enough — that one doesn't count" → "not deep enough". */
function reasonOf(note: RepNote): string {
  const cue = note.cues[0] ?? "that one didn't count";
  const head = cue.split(' — ')[0]!.trim();
  return head.charAt(0).toLowerCase() + head.slice(1);
}

export function summarize(plan: WorkoutPlan, history: RepNote[], seconds: number): WorkoutSummary {
  const sets: SetSummary[] = Array.from({ length: plan.sets }, (_, i) => ({ label: `${plan.name.toUpperCase()} · SET ${i + 1}`, attempts: 0, counted: 0, good: 0, noReps: 0 }));
  const faults = new Map<string, number[]>();
  const reasons = new Map<string, number>();
  let repNumber = 0;
  for (const note of history) {
    const set = sets[Math.min(note.set ?? 0, sets.length - 1)]!;
    set.attempts += 1;
    if (!note.counted) {
      set.noReps += 1;
      const reason = reasonOf(note);
      reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
      continue;
    }
    repNumber += 1;
    set.counted += 1;
    if (note.verdict === 'good') set.good += 1;
    for (const id of note.faults) faults.set(id, [...(faults.get(id) ?? []), repNumber]);
  }
  const counted = sets.reduce((n, s) => n + s.counted, 0);
  const good = sets.reduce((n, s) => n + s.good, 0);
  return {
    exercise: plan.exercise,
    name: plan.name,
    plannedSets: plan.sets,
    plannedReps: plan.reps,
    plannedTotal: plan.sets * plan.reps,
    sets,
    attempts: history.length,
    counted,
    good,
    noReps: history.length - counted,
    cleanPct: counted > 0 ? Math.round((good / counted) * 100) : null,
    faults: [...faults.entries()]
      .map(([id, reps]) => ({ id, said: FAULTS[id]?.said ?? id.replace(/-/g, ' '), fix: FAULTS[id]?.fix ?? 'slow down and stay in control', reps }))
      .sort((a, b) => b.reps.length - a.reps.length),
    noRepReasons: [...reasons.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
    seconds,
  };
}

/** One judged move of a coached session, as it happened. */
export interface MoveResult {
  plan: WorkoutPlan;
  history: RepNote[];
  seconds: number;
}

/**
 * A whole coached session as one summary: every move's sets in order (labelled by move), totals,
 * and form notes across moves. Rep numbers and set indexes run across the session, and the returned
 * history is renumbered to match, so the receipt reads straight through.
 */
export function summarizeSession(moves: MoveResult[], seconds: number): { summary: WorkoutSummary; history: RepNote[] } {
  if (moves.length === 1) return { summary: summarize(moves[0]!.plan, moves[0]!.history, seconds), history: moves[0]!.history };
  const parts = moves.map((m) => summarize(m.plan, m.history, m.seconds));
  const history: RepNote[] = [];
  const faults = new Map<string, number[]>();
  const reasons = new Map<string, number>();
  let setOffset = 0;
  let repOffset = 0;
  parts.forEach((part, i) => {
    for (const note of moves[i]!.history) history.push({ ...note, set: note.set + setOffset });
    for (const fault of part.faults) faults.set(fault.id, [...(faults.get(fault.id) ?? []), ...fault.reps.map((r) => r + repOffset)]);
    for (const { reason, count } of part.noRepReasons) reasons.set(reason, (reasons.get(reason) ?? 0) + count);
    setOffset += part.sets.length;
    repOffset += part.counted;
  });
  const first = parts[0];
  const counted = parts.reduce((n, p) => n + p.counted, 0);
  const good = parts.reduce((n, p) => n + p.good, 0);
  const attempts = parts.reduce((n, p) => n + p.attempts, 0);
  return {
    history,
    summary: {
      exercise: first?.exercise ?? 'session',
      name: parts.map((p) => p.name).join(', '),
      plannedSets: first?.plannedSets ?? 0,
      plannedReps: first?.plannedReps ?? 0,
      plannedTotal: parts.reduce((n, p) => n + p.plannedTotal, 0),
      sets: parts.flatMap((p) => p.sets),
      attempts,
      counted,
      good,
      noReps: attempts - counted,
      cleanPct: counted > 0 ? Math.round((good / counted) * 100) : null,
      faults: [...faults.entries()]
        .map(([id, reps]) => ({ id, said: FAULTS[id]?.said ?? id.replace(/-/g, ' '), fix: FAULTS[id]?.fix ?? 'slow down and stay in control', reps }))
        .sort((a, b) => b.reps.length - a.reps.length),
      noRepReasons: [...reasons.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
      seconds,
    },
  };
}

/** The coach's handwritten note for the receipt, and the one thing to try next time. */
export interface CoachNote {
  note: string;
  nextTime: string;
  /** Who wrote it: the AI coach on Bedrock, or RepCast's own rules from the rep data. */
  source: 'ai' | 'spotter';
}

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function repList(reps: number[]): string {
  if (reps.length > 4) return `${reps.length} reps`;
  if (reps.length === 1) return `rep ${reps[0]}`;
  return `reps ${reps.slice(0, -1).join(', ')} and ${reps[reps.length - 1]}`;
}

/**
 * A plain-spoken note written from the numbers alone — used until (or whenever) the AI coach
 * can't be reached. It only says things the rep data shows.
 */
export function spotterNote(s: WorkoutSummary): CoachNote {
  const lines: string[] = [];
  const rate = (set: SetSummary) => (set.counted > 0 ? set.good / set.counted : null);
  const first = s.sets[0] ? rate(s.sets[0]) : null;
  const last = s.sets.length ? rate(s.sets[s.sets.length - 1]!) : null;
  if (s.sets.length > 1 && first !== null && last !== null && last - first >= 0.15) lines.push('Your form got better after set 1.');
  else if (s.sets.length > 1 && first !== null && last !== null && first - last >= 0.15) lines.push("Your form slipped in the last set — that's tiredness, not technique.");

  const top = s.faults[0];
  if (top) lines.push(`${capitalise(top.said)} on ${repList(top.reps)}.`);

  const reason = s.noRepReasons[0];
  if (s.noReps === 1 && reason) lines.push(`One attempt didn't count: ${reason.reason}.`);
  else if (s.noReps > 1 && reason) lines.push(`${WORDS[s.noReps] ?? s.noReps} attempts didn't count — ${reason.count === s.noReps ? '' : 'mostly '}${reason.reason}.`);

  if (lines.length === 0) lines.push(s.counted > 0 ? 'Every rep counted, and every one was clean.' : "Nothing counted this time — let's set the phone up again and go slower.");

  // Stopped well short of the plan (ended early): the next step is finishing it, not more.
  const finished = s.plannedTotal === 0 || s.counted >= s.plannedTotal * 0.9;
  let nextTime: string;
  if (s.counted === 0) nextTime = 'phone at hip height, about 2.5 m back, with your whole body in view.';
  else if (!finished) nextTime = 'every set, start to finish — slower is fine.';
  else if (reason && reason.reason.startsWith('not deep') && reason.count >= 2) nextTime = `${Math.max(6, s.plannedReps - 2)} reps with a 2-second pause at the bottom.`;
  else if (top && top.reps.length >= 2) nextTime = `same reps, slower, ${top.fix}.`;
  else if ((s.cleanPct ?? 0) >= 90 && s.noReps <= 1) nextTime = `we add a set — ${s.plannedSets + 1} × ${s.plannedReps}.`;
  else nextTime = 'same plan, a slower way down.';

  return { note: lines.join(' '), nextTime, source: 'spotter' };
}

/** The receipt's big line, matched to how the session actually went. */
export function receiptHeadline(s: WorkoutSummary): { lead: string; italic: string } {
  if (s.cleanPct === null) return { lead: "Let's try\n", italic: 'that again.' };
  // Ended well before the plan: praise the effort, not the session.
  if (s.plannedTotal > 0 && s.counted < s.plannedTotal / 2) return { lead: 'A short one.\n', italic: 'It still counts.' };
  const clean = s.cleanPct;
  if (clean >= 80) return { lead: 'That was a\n', italic: 'good one.' };
  if (clean >= 50) return { lead: 'Honest work,\n', italic: 'every rep.' };
  return { lead: 'A tough one.\n', italic: 'It still counts.' };
}

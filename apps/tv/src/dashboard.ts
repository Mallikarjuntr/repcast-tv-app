import type { AnalysisRequest } from '@spotter/shared';

/** Which angle the depth is measured at, for moves where a "lowest angle" means something to people. */
const DEPTH_JOINT: Record<string, string> = {
  squat: 'KNEE',
  'half-squat': 'KNEE',
  'sumo-squat': 'KNEE',
  lunge: 'FRONT KNEE',
  'reverse-lunge': 'FRONT KNEE',
  'split-squat': 'FRONT KNEE',
  'curtsy-lunge': 'FRONT KNEE',
  'push-up': 'ELBOW',
  'knee-push-up': 'ELBOW',
};

export type Verdict = 'good' | 'fix' | 'no-rep';

export interface AttemptBar {
  set: number;
  verdict: Verdict;
  counted: boolean;
  /** Lowest angle in degrees, when the phone sent it. */
  bottom: number | null;
  /** 0..1 of the deepest attempt in this workout: every move dips, so a lower angle is more range. */
  range: number;
}

export interface Dashboard {
  attempts: number;
  counted: number;
  clean: number;
  withNote: number;
  noReps: number;
  planned: number;
  /** Clean share of counted reps, or null with nothing counted. */
  cleanPct: number | null;
  /** Lowest angle of a counted rep and the joint it's at, for moves where that reads naturally. */
  deepest: { deg: number; joint: string } | null;
  /** Median seconds per counted rep. */
  pace: number | null;
  seconds: number;
  bars: AttemptBar[];
  sets: { set: number; attempts: number; counted: number; clean: number }[];
  /** Why reps didn't count or got a note, most common first. */
  reasons: { text: string; count: number }[];
  /** Earlier sessions of this move, oldest first, then today: reps counted and clean ones. */
  trend: { label: string; reps: number; clean: number | null; today: boolean }[];
  /** Change since the last session of this move. */
  vsLast: { reps: number; cleanPct: number | null } | null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Everything the analysis screen charts, worked out on the TV from the rep numbers: instant, free
 * and the same every time. The AI only adds a coach's note on top.
 */
export function buildDashboard(req: AnalysisRequest): Dashboard {
  const a = req.attempts;
  const counted = a.filter((x) => x.counted).length;
  const clean = a.filter((x) => x.counted && x.verdict === 'good').length;
  const withNote = counted - clean;
  const noReps = a.length - counted;

  const ranges = a.map((x) => (x.bottomDeg === undefined ? null : Math.max(0, 180 - x.bottomDeg)));
  const best = Math.max(0, ...ranges.map((r) => r ?? 0));
  const bars: AttemptBar[] = a.map((x, i) => ({
    set: x.set,
    verdict: x.verdict,
    counted: x.counted,
    bottom: x.bottomDeg ?? null,
    range: best > 0 && ranges[i] !== null ? Math.max(0.08, ranges[i]! / best) : 0.6,
  }));

  const joint = DEPTH_JOINT[req.move.id];
  const countedBottoms = a.filter((x) => x.counted && x.bottomDeg !== undefined).map((x) => x.bottomDeg!);
  const deepest = joint && countedBottoms.length ? { deg: Math.round(Math.min(...countedBottoms)), joint } : null;
  const durations = a.filter((x) => x.counted && x.durationMs !== undefined).map((x) => x.durationMs! / 1000);
  const pace = median(durations);

  const setIds = [...new Set(a.map((x) => x.set))].sort((x, y) => x - y);
  const sets = setIds.map((set) => {
    const inSet = a.filter((x) => x.set === set);
    return { set, attempts: inSet.length, counted: inSet.filter((x) => x.counted).length, clean: inSet.filter((x) => x.counted && x.verdict === 'good').length };
  });

  const tally = new Map<string, number>();
  for (const x of a) if (x.verdict !== 'good' && x.reason) tally.set(x.reason, (tally.get(x.reason) ?? 0) + 1);
  const reasons = [...tally.entries()].map(([text, count]) => ({ text, count })).sort((x, y) => y.count - x.count).slice(0, 3);

  // `previous` is newest first.
  const earlier = req.previous.slice(0, 7).reverse();
  const trend = [
    ...earlier.map((p) => ({ label: p.daysAgo === 0 ? 'Today' : `${p.daysAgo}d ago`, reps: p.reps, clean: p.cleanReps ?? null, today: false })),
    // This workout is ringed, so an earlier one today can share the label.
    { label: 'Now', reps: counted, clean, today: true },
  ];
  const last = req.previous[0];
  const pct = (c: number | undefined, r: number) => (c === undefined || r === 0 ? null : Math.round((c / r) * 100));
  const cleanPct = counted ? Math.round((clean / counted) * 100) : null;
  const lastPct = last ? pct(last.cleanReps, last.reps) : null;
  const vsLast = last ? { reps: counted - last.reps, cleanPct: cleanPct !== null && lastPct !== null ? cleanPct - lastPct : null } : null;

  return {
    attempts: a.length,
    counted,
    clean,
    withNote,
    noReps,
    planned: req.plan.sets * req.plan.reps,
    cleanPct,
    deepest,
    pace: pace === null ? null : Math.round(pace * 10) / 10,
    seconds: req.seconds,
    bars,
    sets,
    reasons,
    trend,
    vsLast,
  };
}

/** The headline the numbers support, e.g. "18 of 24 counted · 89% clean". */
export function dashboardHeadline(d: Dashboard): string {
  if (d.attempts === 0) return 'No reps to look at yet';
  const counted = d.counted >= d.planned ? `All ${d.planned} counted` : `${d.counted} of ${d.planned} counted`;
  return d.cleanPct === null ? counted : `${counted} · ${d.cleanPct}% clean`;
}

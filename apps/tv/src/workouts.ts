/** Points in POSE_POINTS order as [x, y] pairs: nose, shoulders, elbows, wrists, hips, knees, ankles. */
type Keyframe = number[];

/** A demo movement: the figure eases between keyframe A (start) and B (end of the "down" phase). */
export interface Demo {
  a: Keyframe;
  b: Keyframe;
  /** Camera width / height of the drawing. */
  aspect: number;
  /** Fit the whole body in the panel (for lying poses) instead of fitting by height. */
  fitBox?: boolean;
}

interface StepBase {
  id: string;
  name: string;
  /** How the move reads inside a sentence, e.g. "a march on the spot". */
  phrase: string;
  /** One line on why you'd pick this move — shown when swapping. */
  why: string;
  demo: Demo;
}

export type Step =
  | (StepBase & {
      kind: 'reps';
      sets: number;
      reps: number;
      /** Seconds for the down and up halves of each rep: the tempo beat. */
      beat: { down: number; up: number };
      restSeconds: number;
      /** Spoken at the start of the set, then the down and up cues alternate on screen. */
      cues: { start: string; down: string; up: string };
    })
  | (StepBase & {
      kind: 'timed';
      seconds: number;
      cue: string;
      /** Seconds per demo cycle; 0 holds the pose still. */
      cycle: number;
    });

export interface Session {
  id: string;
  title: string;
  titleItalic: string;
  summary: string;
  coachNote: string;
  steps: Step[];
}

// Keyframes are drawn on a square grid.
const FRONT = 1;

/** Mirror a front-view keyframe left to right (swaps left and right body parts). */
function mirror(k: Keyframe): Keyframe {
  const out = [...k];
  const partner = (i: number) => (i === 0 ? 0 : i % 2 === 1 ? i + 1 : i - 1);
  for (let i = 0; i < 13; i++) {
    const j = partner(i);
    out[i * 2] = 1 - k[j * 2]!;
    out[i * 2 + 1] = k[j * 2 + 1]!;
  }
  return out;
}

// Standing, front view.
const STAND: Keyframe = [0.5, 0.21, 0.42, 0.3, 0.58, 0.3, 0.4, 0.41, 0.6, 0.41, 0.42, 0.51, 0.58, 0.51, 0.45, 0.5, 0.55, 0.5, 0.43, 0.69, 0.57, 0.69, 0.44, 0.87, 0.56, 0.87];
// Bottom of a squat: hips down and back, arms forward for balance.
const SQUAT: Keyframe = [0.5, 0.39, 0.42, 0.47, 0.58, 0.47, 0.4, 0.5, 0.6, 0.5, 0.42, 0.5, 0.58, 0.5, 0.45, 0.65, 0.55, 0.65, 0.39, 0.69, 0.61, 0.69, 0.44, 0.87, 0.56, 0.87];
// Wide stance, hands together at the chest; and the bottom of a sumo squat.
const SUMO_TOP: Keyframe = [0.5, 0.21, 0.42, 0.3, 0.58, 0.3, 0.41, 0.4, 0.59, 0.4, 0.48, 0.37, 0.52, 0.37, 0.45, 0.5, 0.55, 0.5, 0.39, 0.69, 0.61, 0.69, 0.36, 0.87, 0.64, 0.87];
const SUMO: Keyframe = [0.5, 0.35, 0.42, 0.44, 0.58, 0.44, 0.41, 0.54, 0.59, 0.54, 0.48, 0.5, 0.52, 0.5, 0.45, 0.63, 0.55, 0.63, 0.34, 0.68, 0.66, 0.68, 0.36, 0.87, 0.64, 0.87];
// Bottom of a lunge: right knee towards the floor, left knee over the front foot.
const LUNGE: Keyframe = [0.5, 0.34, 0.42, 0.43, 0.58, 0.43, 0.41, 0.54, 0.59, 0.54, 0.43, 0.63, 0.57, 0.63, 0.45, 0.63, 0.55, 0.63, 0.42, 0.74, 0.58, 0.82, 0.43, 0.88, 0.6, 0.9];
// Jumping jack, open: arms overhead, feet wide.
const JACK_OPEN: Keyframe = [0.5, 0.21, 0.42, 0.3, 0.58, 0.3, 0.33, 0.21, 0.67, 0.21, 0.3, 0.1, 0.7, 0.1, 0.45, 0.5, 0.55, 0.5, 0.38, 0.69, 0.62, 0.69, 0.33, 0.87, 0.67, 0.87];
// Step jack: arms overhead, one foot steps out (no jump).
const STEP_JACK: Keyframe = [0.5, 0.21, 0.42, 0.3, 0.58, 0.3, 0.33, 0.21, 0.67, 0.21, 0.3, 0.1, 0.7, 0.1, 0.45, 0.5, 0.55, 0.5, 0.43, 0.69, 0.61, 0.69, 0.44, 0.87, 0.68, 0.87];
// Marching: left knee up / right knee up; high knees lift higher.
const MARCH_L: Keyframe = [0.5, 0.21, 0.42, 0.3, 0.58, 0.3, 0.4, 0.41, 0.6, 0.38, 0.43, 0.5, 0.6, 0.45, 0.45, 0.5, 0.55, 0.5, 0.43, 0.6, 0.57, 0.69, 0.44, 0.75, 0.56, 0.87];
const MARCH_R = mirror(MARCH_L);
const HIGH_KNEE_L: Keyframe = [0.5, 0.21, 0.42, 0.3, 0.58, 0.3, 0.4, 0.39, 0.6, 0.36, 0.44, 0.45, 0.61, 0.42, 0.45, 0.5, 0.55, 0.5, 0.42, 0.52, 0.57, 0.69, 0.44, 0.68, 0.56, 0.87];
const HIGH_KNEE_R = mirror(HIGH_KNEE_L);
// Step touch: weight on one foot, the other tapping out to the side.
const STEP_TOUCH_L: Keyframe = [0.48, 0.21, 0.4, 0.3, 0.56, 0.3, 0.36, 0.4, 0.6, 0.4, 0.35, 0.49, 0.61, 0.49, 0.43, 0.5, 0.53, 0.5, 0.42, 0.69, 0.56, 0.69, 0.42, 0.87, 0.64, 0.87];
const STEP_TOUCH_R = mirror(STEP_TOUCH_L);
// Reaching up for the cool-down stretch; and leaning into a side bend.
const REACH: Keyframe = [0.5, 0.21, 0.42, 0.3, 0.58, 0.3, 0.43, 0.19, 0.57, 0.19, 0.46, 0.08, 0.54, 0.08, 0.45, 0.5, 0.55, 0.5, 0.43, 0.69, 0.57, 0.69, 0.44, 0.87, 0.56, 0.87];
const SIDE_BEND_L: Keyframe = [0.45, 0.23, 0.39, 0.33, 0.55, 0.3, 0.36, 0.22, 0.51, 0.19, 0.35, 0.12, 0.42, 0.1, 0.45, 0.5, 0.55, 0.5, 0.43, 0.69, 0.57, 0.69, 0.44, 0.87, 0.56, 0.87];
const SIDE_BEND_R = mirror(SIDE_BEND_L);
// High plank, seen from the side: hands under shoulders, one straight line to the heels (floor at y 0.7).
const PLANK: Keyframe = [0.17, 0.47, 0.25, 0.5, 0.26, 0.5, 0.25, 0.6, 0.26, 0.6, 0.25, 0.7, 0.26, 0.7, 0.45, 0.555, 0.46, 0.555, 0.64, 0.61, 0.65, 0.61, 0.82, 0.665, 0.83, 0.665];
// Knee plank: knees on the floor, one line from shoulders to knees.
const KNEE_PLANK: Keyframe = [0.17, 0.47, 0.25, 0.5, 0.26, 0.5, 0.25, 0.6, 0.26, 0.6, 0.25, 0.7, 0.26, 0.7, 0.47, 0.593, 0.48, 0.593, 0.7, 0.69, 0.71, 0.69, 0.84, 0.6, 0.85, 0.6];
// Forearm plank: elbows under shoulders, forearms flat on the floor.
const FOREARM_PLANK: Keyframe = [0.19, 0.56, 0.27, 0.59, 0.28, 0.59, 0.27, 0.69, 0.28, 0.69, 0.17, 0.7, 0.18, 0.7, 0.46, 0.617, 0.47, 0.617, 0.65, 0.644, 0.66, 0.644, 0.83, 0.67, 0.84, 0.67];

const MARCH: Step = {
  kind: 'timed', id: 'march', name: 'March on the spot', phrase: 'a march on the spot', why: 'Warms you up without any impact.',
  seconds: 40, cue: 'March on the spot — easy pace, arms swinging', cycle: 1.2, demo: { a: MARCH_L, b: MARCH_R, aspect: FRONT },
};
const STEP_TOUCH: Step = {
  kind: 'timed', id: 'step-touch', name: 'Step touch', phrase: 'a step touch', why: 'Side to side, one foot always on the floor.',
  seconds: 40, cue: 'Step out, tap in — side to side, easy rhythm', cycle: 1.4, demo: { a: STEP_TOUCH_L, b: STEP_TOUCH_R, aspect: FRONT },
};
const HIGH_KNEES: Step = {
  kind: 'timed', id: 'high-knees', name: 'High knees', phrase: 'high knees', why: 'A warmer warm-up, if you have the energy.',
  seconds: 40, cue: 'Knees up to hip height — quick feet', cycle: 0.7, demo: { a: HIGH_KNEE_L, b: HIGH_KNEE_R, aspect: FRONT },
};

const SQUATS: Step = {
  kind: 'reps', id: 'squat', name: 'Squats', phrase: 'squats', why: 'The classic — hips back, chest up.',
  sets: 3, reps: 12, beat: { down: 2, up: 1.5 }, restSeconds: 30,
  cues: { start: 'Squats. Twelve reps. Follow the beat.', down: 'sit back… chest up', up: 'drive up through your heels' },
  demo: { a: STAND, b: SQUAT, aspect: FRONT },
};
const HALF_SQUATS: Step = {
  kind: 'reps', id: 'half-squat', name: 'Half squats', phrase: 'half squats', why: 'Only halfway down — kinder to tight knees.',
  sets: 3, reps: 12, beat: { down: 1.5, up: 1.5 }, restSeconds: 30,
  cues: { start: 'Half squats. Twelve reps. Only go halfway.', down: 'halfway down… chest up', up: 'stand tall' },
  demo: { a: STAND, b: STAND.map((v, i) => v + (SQUAT[i]! - v) * 0.5), aspect: FRONT },
};
const SUMO_SQUATS: Step = {
  kind: 'reps', id: 'sumo-squat', name: 'Sumo squats', phrase: 'sumo squats', why: 'Wide feet, toes out — more inner thigh, less back.',
  sets: 3, reps: 12, beat: { down: 2, up: 1.5 }, restSeconds: 30,
  cues: { start: 'Sumo squats. Twelve reps. Feet wide, toes out.', down: 'knees out over your toes', up: 'squeeze up to standing' },
  demo: { a: SUMO_TOP, b: SUMO, aspect: FRONT },
};

const LUNGES: Step = {
  kind: 'reps', id: 'lunge', name: 'Lunges', phrase: 'lunges', why: 'One leg at a time — balance and strength.',
  sets: 2, reps: 10, beat: { down: 2, up: 1.5 }, restSeconds: 30,
  cues: { start: 'Lunges. Ten reps. Swap legs whenever you like.', down: 'back knee towards the floor', up: 'push through the front heel' },
  demo: { a: STAND, b: LUNGE, aspect: FRONT },
};
const REVERSE_LUNGES: Step = {
  kind: 'reps', id: 'reverse-lunge', name: 'Reverse lunges', phrase: 'reverse lunges', why: 'Step back, not forward — easier on the front knee.',
  sets: 2, reps: 10, beat: { down: 2, up: 1.5 }, restSeconds: 30,
  cues: { start: 'Reverse lunges. Ten reps. Step back, then return.', down: 'step back, knee down', up: 'drive back to standing' },
  demo: { a: STAND, b: LUNGE, aspect: FRONT },
};
const SPLIT_SQUATS: Step = {
  kind: 'reps', id: 'split-squat', name: 'Split squats', phrase: 'split squats', why: 'Feet stay put — steadier if balance is tricky.',
  sets: 2, reps: 10, beat: { down: 2, up: 1.5 }, restSeconds: 30,
  cues: { start: 'Split squats. Ten reps. Feet stay where they are.', down: 'straight down, back knee low', up: 'up through the front foot' },
  demo: { a: STAND.map((v, i) => v + (LUNGE[i]! - v) * 0.15), b: LUNGE, aspect: FRONT },
};

const JUMPING_JACKS: Step = {
  kind: 'reps', id: 'jumping-jack', name: 'Jumping jacks', phrase: 'jumping jacks', why: 'Gets the heart going fast.',
  sets: 2, reps: 20, beat: { down: 0.5, up: 0.5 }, restSeconds: 20,
  cues: { start: 'Jumping jacks. Twenty. Light on your feet.', down: 'arms up, feet wide', up: 'back together' },
  demo: { a: STAND, b: JACK_OPEN, aspect: FRONT },
};
const STEP_JACKS: Step = {
  kind: 'reps', id: 'step-jack', name: 'Step jacks', phrase: 'step jacks', why: 'No jumping — quiet for the neighbours, easy on joints.',
  sets: 2, reps: 20, beat: { down: 0.8, up: 0.8 }, restSeconds: 20,
  cues: { start: 'Step jacks. Twenty. Step out, arms up — no jumping.', down: 'step out, arms up', up: 'step in' },
  demo: { a: STAND, b: STEP_JACK, aspect: FRONT },
};

const PLANK_HOLD: Step = {
  kind: 'timed', id: 'plank', name: 'Plank', phrase: 'a plank', why: 'Whole-body hold — a strong core finisher.',
  seconds: 30, cue: 'Hold a straight line from shoulders to heels', cycle: 0, demo: { a: PLANK, b: PLANK, aspect: FRONT, fitBox: true },
};
const KNEE_PLANK_HOLD: Step = {
  kind: 'timed', id: 'knee-plank', name: 'Knee plank', phrase: 'a knee plank', why: 'Knees down — same idea, half the load.',
  seconds: 30, cue: 'Knees down, straight line from shoulders to knees', cycle: 0, demo: { a: KNEE_PLANK, b: KNEE_PLANK, aspect: FRONT, fitBox: true },
};
const FOREARM_PLANK_HOLD: Step = {
  kind: 'timed', id: 'forearm-plank', name: 'Forearm plank', phrase: 'a forearm plank', why: 'On your elbows — kinder to sore wrists.',
  seconds: 30, cue: 'Elbows under shoulders, hold one straight line', cycle: 0, demo: { a: FOREARM_PLANK, b: FOREARM_PLANK, aspect: FRONT, fitBox: true },
};

const REACH_BREATHE: Step = {
  kind: 'timed', id: 'cool-down', name: 'Reach and breathe', phrase: 'a slow reach', why: 'Long breaths to bring your heart rate down.',
  seconds: 30, cue: 'Reach up tall, then let your arms float down', cycle: 6, demo: { a: STAND, b: REACH, aspect: FRONT },
};
const SIDE_BENDS: Step = {
  kind: 'timed', id: 'side-bend', name: 'Side bends', phrase: 'side bends', why: 'Stretches your sides after all that squatting.',
  seconds: 30, cue: 'Arms up, lean slowly side to side', cycle: 6, demo: { a: SIDE_BEND_L, b: SIDE_BEND_R, aspect: FRONT },
};

/** The moves each step can be swapped for, the original first. Keyed by the original step's id. */
export const SWAP_OPTIONS: Record<string, Step[]> = {
  [MARCH.id]: [MARCH, STEP_TOUCH, HIGH_KNEES],
  [SQUATS.id]: [SQUATS, HALF_SQUATS, SUMO_SQUATS],
  [LUNGES.id]: [LUNGES, REVERSE_LUNGES, SPLIT_SQUATS],
  [JUMPING_JACKS.id]: [JUMPING_JACKS, STEP_JACKS],
  [PLANK_HOLD.id]: [PLANK_HOLD, KNEE_PLANK_HOLD, FOREARM_PLANK_HOLD],
  [REACH_BREATHE.id]: [REACH_BREATHE, SIDE_BENDS],
};

/** Chosen swaps: original step id → the id of the move used instead. */
export type Swaps = Record<string, string>;

function listOf(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** "Squats, lunges and jumping jacks — a march on the spot to warm up, a plank and a slow reach to finish." */
export function describe(steps: Step[]): string {
  const firstReps = steps.findIndex((s) => s.kind === 'reps');
  const lastReps = steps.length - 1 - [...steps].reverse().findIndex((s) => s.kind === 'reps');
  const main = listOf(steps.filter((s) => s.kind === 'reps').map((s) => s.phrase));
  const warmUp = steps.slice(0, Math.max(0, firstReps)).map((s) => s.phrase);
  const finish = steps.slice(lastReps + 1).map((s) => s.phrase);
  const parts = [warmUp.length ? `${listOf(warmUp)} to warm up` : '', finish.length ? `${listOf(finish)} to finish` : ''].filter(Boolean);
  return `${main.charAt(0).toUpperCase()}${main.slice(1)}${parts.length ? ` — ${parts.join(', ')}` : ''}.`;
}

/** The session with the chosen swaps applied, and its summary written to match. */
export function applySwaps(session: Session, swaps: Swaps): Session {
  const steps = session.steps.map((step) => SWAP_OPTIONS[step.id]?.find((option) => option.id === swaps[step.id]) ?? step);
  return { ...session, steps, summary: describe(steps) };
}

const BASE_STEPS = [MARCH, SQUATS, LUNGES, JUMPING_JACKS, PLANK_HOLD, REACH_BREATHE];

export const LEGS_GENTLY: Session = {
  id: 'legs-gently',
  title: 'Legs,\n',
  titleItalic: 'gently.',
  summary: describe(BASE_STEPS),
  coachNote: "go slow on the way down —\nI'll do the counting.",
  steps: BASE_STEPS,
};

/** A keyframe between a and b at t (0..1). */
export function blend(a: Keyframe, b: Keyframe, t: number): number[] {
  return a.map((v, i) => v + (b[i]! - v) * t);
}

export function totalReps(session: Session): number {
  return session.steps.reduce((sum, s) => sum + (s.kind === 'reps' ? s.sets * s.reps : 0), 0);
}

/** Rough length of a session in seconds, rests included (timed steps get a 10 s breather after them). */
export function estimateSeconds(session: Session): number {
  return session.steps.reduce((sum, s, i) => {
    const last = i === session.steps.length - 1;
    if (s.kind === 'timed') return sum + s.seconds + (last ? 0 : 10);
    const work = s.sets * s.reps * (s.beat.down + s.beat.up);
    const rests = (s.sets - (last ? 1 : 0)) * s.restSeconds;
    return sum + work + rests;
  }, 0);
}

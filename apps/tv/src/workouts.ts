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
  /** One line on why you'd pick this move — shown when picking it. */
  why: string;
  /** A gentler version of another move in its group (tagged "EASIER" when picking). */
  easier?: boolean;
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
      /** The repcast-movement exercise that judges this move on camera; without one it is followed, not judged. */
      engine?: string;
    })
  | (StepBase & {
      kind: 'timed';
      seconds: number;
      cue: string;
      /** Seconds per demo cycle; 0 holds the pose still. */
      cycle: number;
    });

/** What a workout screen runs: today that's always one move (see singleMove). */
export interface Session {
  id: string;
  title: string;
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
// High plank, seen from the side: hands under shoulders, one straight line to the heels (floor at y 0.7).
const PLANK: Keyframe = [0.17, 0.47, 0.25, 0.5, 0.26, 0.5, 0.25, 0.6, 0.26, 0.6, 0.25, 0.7, 0.26, 0.7, 0.45, 0.555, 0.46, 0.555, 0.64, 0.61, 0.65, 0.61, 0.82, 0.665, 0.83, 0.665];
// Knee plank: knees on the floor, one line from shoulders to knees.
const KNEE_PLANK: Keyframe = [0.17, 0.47, 0.25, 0.5, 0.26, 0.5, 0.25, 0.6, 0.26, 0.6, 0.25, 0.7, 0.26, 0.7, 0.47, 0.593, 0.48, 0.593, 0.7, 0.69, 0.71, 0.69, 0.84, 0.6, 0.85, 0.6];
// Forearm plank: elbows under shoulders, forearms flat on the floor.
const FOREARM_PLANK: Keyframe = [0.19, 0.56, 0.27, 0.59, 0.28, 0.59, 0.27, 0.69, 0.28, 0.69, 0.17, 0.7, 0.18, 0.7, 0.46, 0.617, 0.47, 0.617, 0.65, 0.644, 0.66, 0.644, 0.83, 0.67, 0.84, 0.67];

// Up on the toes.
const TOES: Keyframe = STAND.map((v, i) => (i % 2 === 1 && i < 23 ? v - 0.03 : v));
// Push-up, side view: bottom of the rep, chest near the floor (top is the plank).
const PUSH_DOWN: Keyframe = [0.17, 0.59, 0.25, 0.62, 0.26, 0.62, 0.31, 0.66, 0.32, 0.66, 0.25, 0.7, 0.26, 0.7, 0.45, 0.635, 0.46, 0.635, 0.64, 0.65, 0.65, 0.65, 0.82, 0.665, 0.83, 0.665];
const KNEE_PUSH_DOWN: Keyframe = [0.17, 0.59, 0.25, 0.62, 0.26, 0.62, 0.31, 0.66, 0.32, 0.66, 0.25, 0.7, 0.26, 0.7, 0.47, 0.65, 0.48, 0.65, 0.7, 0.69, 0.71, 0.69, 0.84, 0.6, 0.85, 0.6];
// Glute bridge, side view, lying on the back: hips down, and lifted into one line with the knees.
const BRIDGE_DOWN: Keyframe = [0.15, 0.72, 0.25, 0.74, 0.26, 0.74, 0.35, 0.76, 0.36, 0.76, 0.45, 0.77, 0.46, 0.77, 0.45, 0.75, 0.46, 0.75, 0.6, 0.6, 0.61, 0.6, 0.68, 0.76, 0.69, 0.76];
const BRIDGE_UP: Keyframe = BRIDGE_DOWN.map((v, i) => (i === 15 || i === 17 ? 0.66 : v));
// Wall sit: thighs level, back straight against the wall.
const WALL_SIT_POSE: Keyframe = [0.5, 0.36, 0.42, 0.45, 0.58, 0.45, 0.41, 0.56, 0.59, 0.56, 0.43, 0.64, 0.57, 0.64, 0.45, 0.67, 0.55, 0.67, 0.39, 0.69, 0.61, 0.69, 0.44, 0.87, 0.56, 0.87];

const SQUATS: Step = {
  kind: 'reps', id: 'squat', engine: 'squat', name: 'Squats', why: 'The classic — hips back, chest up.',
  sets: 3, reps: 12, beat: { down: 2, up: 1.5 }, restSeconds: 30,
  cues: { start: 'Squats. Twelve reps. Follow the beat.', down: 'sit back… chest up', up: 'drive up through your heels' },
  demo: { a: STAND, b: SQUAT, aspect: FRONT },
};
const HALF_SQUATS: Step = {
  kind: 'reps', id: 'half-squat', easier: true, engine: 'half-squat', name: 'Half squats', why: 'Only halfway down — kinder to tight knees.',
  sets: 3, reps: 12, beat: { down: 1.5, up: 1.5 }, restSeconds: 30,
  cues: { start: 'Half squats. Twelve reps. Only go halfway.', down: 'halfway down… chest up', up: 'stand tall' },
  demo: { a: STAND, b: STAND.map((v, i) => v + (SQUAT[i]! - v) * 0.5), aspect: FRONT },
};
const SUMO_SQUATS: Step = {
  kind: 'reps', id: 'sumo-squat', engine: 'sumo-squat', name: 'Sumo squats', why: 'Wide feet, toes out — more inner thigh, less back.',
  sets: 3, reps: 12, beat: { down: 2, up: 1.5 }, restSeconds: 30,
  cues: { start: 'Sumo squats. Twelve reps. Feet wide, toes out.', down: 'knees out over your toes', up: 'squeeze up to standing' },
  demo: { a: SUMO_TOP, b: SUMO, aspect: FRONT },
};

const LUNGES: Step = {
  kind: 'reps', id: 'lunge', engine: 'lunge', name: 'Lunges', why: 'One leg at a time — balance and strength.',
  sets: 2, reps: 10, beat: { down: 2, up: 1.5 }, restSeconds: 30,
  cues: { start: 'Lunges. Ten reps. Swap legs whenever you like.', down: 'back knee towards the floor', up: 'push through the front heel' },
  demo: { a: STAND, b: LUNGE, aspect: FRONT },
};
const REVERSE_LUNGES: Step = {
  kind: 'reps', id: 'reverse-lunge', engine: 'reverse-lunge', name: 'Reverse lunges', why: 'Step back, not forward — easier on the front knee.',
  sets: 2, reps: 10, beat: { down: 2, up: 1.5 }, restSeconds: 30,
  cues: { start: 'Reverse lunges. Ten reps. Step back, then return.', down: 'step back, knee down', up: 'drive back to standing' },
  demo: { a: STAND, b: LUNGE, aspect: FRONT },
};
const SPLIT_SQUATS: Step = {
  kind: 'reps', id: 'split-squat', engine: 'split-squat', name: 'Split squats', why: 'Feet stay put — steadier if balance is tricky.',
  sets: 2, reps: 10, beat: { down: 2, up: 1.5 }, restSeconds: 30,
  cues: { start: 'Split squats. Ten reps. Feet stay where they are.', down: 'straight down, back knee low', up: 'up through the front foot' },
  demo: { a: STAND.map((v, i) => v + (LUNGE[i]! - v) * 0.15), b: LUNGE, aspect: FRONT },
};

const JUMPING_JACKS: Step = {
  kind: 'reps', id: 'jumping-jack', engine: 'jumping-jack', name: 'Jumping jacks', why: 'Gets the heart going fast.',
  sets: 2, reps: 20, beat: { down: 0.5, up: 0.5 }, restSeconds: 20,
  cues: { start: 'Jumping jacks. Twenty. Light on your feet.', down: 'arms up, feet wide', up: 'back together' },
  demo: { a: STAND, b: JACK_OPEN, aspect: FRONT },
};
const STEP_JACKS: Step = {
  kind: 'reps', id: 'step-jack', easier: true, engine: 'step-jack', name: 'Step jacks', why: 'No jumping — quiet for the neighbours, easy on joints.',
  sets: 2, reps: 20, beat: { down: 0.8, up: 0.8 }, restSeconds: 20,
  cues: { start: 'Step jacks. Twenty. Step out, arms up — no jumping.', down: 'step out, arms up', up: 'step in' },
  demo: { a: STAND, b: STEP_JACK, aspect: FRONT },
};

const CURTSY_LUNGES: Step = {
  kind: 'reps', id: 'curtsy-lunge', engine: 'curtsy-lunge', name: 'Curtsy lunges', why: 'Step back and across — works the sides of your hips.',
  sets: 2, reps: 10, beat: { down: 2, up: 1.5 }, restSeconds: 30,
  cues: { start: 'Curtsy lunges. Ten reps. Step back and across.', down: 'back and across, knee down', up: 'push back to standing' },
  demo: { a: STAND, b: LUNGE, aspect: FRONT },
};
const CALF_RAISES: Step = {
  kind: 'reps', id: 'calf-raise', name: 'Calf raises', why: 'Up on your toes — ankles and calves, no impact.',
  sets: 2, reps: 15, beat: { down: 1, up: 1 }, restSeconds: 20,
  cues: { start: 'Calf raises. Fifteen reps. Up onto your toes.', down: 'rise up tall', up: 'lower slowly' },
  demo: { a: STAND, b: TOES, aspect: FRONT },
};
const WALL_SIT: Step = {
  kind: 'timed', id: 'wall-sit', name: 'Wall sit', why: 'A squat held against the wall — strength with no movement.',
  seconds: 30, cue: 'Back against the wall, thighs level — hold', cycle: 0, demo: { a: WALL_SIT_POSE, b: WALL_SIT_POSE, aspect: FRONT },
};

const PUSH_UPS: Step = {
  kind: 'reps', id: 'push-up', engine: 'push-up', name: 'Push-ups', why: 'Chest, arms and core in one move.',
  sets: 2, reps: 10, beat: { down: 1.5, up: 1.5 }, restSeconds: 30,
  cues: { start: 'Push-ups. Ten reps. Phone on the floor, side-on.', down: 'chest towards the floor', up: 'push the floor away' },
  demo: { a: PLANK, b: PUSH_DOWN, aspect: FRONT, fitBox: true },
};
const KNEE_PUSH_UPS: Step = {
  kind: 'reps', id: 'knee-push-up', easier: true, engine: 'knee-push-up', name: 'Knee push-ups', why: 'Knees down — the same push, a lighter load.',
  sets: 2, reps: 10, beat: { down: 1.5, up: 1.5 }, restSeconds: 30,
  cues: { start: 'Knee push-ups. Ten reps. Phone on the floor, side-on.', down: 'chest towards the floor', up: 'push the floor away' },
  demo: { a: KNEE_PLANK, b: KNEE_PUSH_DOWN, aspect: FRONT, fitBox: true },
};
const GLUTE_BRIDGES: Step = {
  kind: 'reps', id: 'glute-bridge', engine: 'glute-bridge', name: 'Glute bridges', why: 'Lying down, kind to your back — strong glutes.',
  sets: 2, reps: 12, beat: { down: 1.5, up: 1.5 }, restSeconds: 30,
  cues: { start: 'Glute bridges. Twelve reps. Lie back, knees bent.', down: 'lift your hips, squeeze', up: 'lower slowly' },
  demo: { a: BRIDGE_DOWN, b: BRIDGE_UP, aspect: FRONT, fitBox: true },
};

const PLANK_HOLD: Step = {
  kind: 'timed', id: 'plank', name: 'Plank', why: 'Whole-body hold — shoulders, core and legs.',
  seconds: 30, cue: 'Hold a straight line from shoulders to heels', cycle: 0, demo: { a: PLANK, b: PLANK, aspect: FRONT, fitBox: true },
};
const KNEE_PLANK_HOLD: Step = {
  kind: 'timed', id: 'knee-plank', easier: true, name: 'Knee plank', why: 'Knees down — same idea, half the load.',
  seconds: 30, cue: 'Knees down, straight line from shoulders to knees', cycle: 0, demo: { a: KNEE_PLANK, b: KNEE_PLANK, aspect: FRONT, fitBox: true },
};
const FOREARM_PLANK_HOLD: Step = {
  kind: 'timed', id: 'forearm-plank', name: 'Forearm plank', why: 'On your elbows — kinder to sore wrists.',
  seconds: 30, cue: 'Elbows under shoulders, hold one straight line', cycle: 0, demo: { a: FOREARM_PLANK, b: FOREARM_PLANK, aspect: FRONT, fitBox: true },
};

/** Every move, in the sections the picker shows. Warm-ups are gone: you pick one move and do it. */
export interface MoveGroup {
  title: string;
  moves: Step[];
}
export const MOVE_GROUPS: MoveGroup[] = [
  { title: 'Squats', moves: [SQUATS, HALF_SQUATS, SUMO_SQUATS, WALL_SIT] },
  { title: 'Lunges', moves: [LUNGES, REVERSE_LUNGES, SPLIT_SQUATS, CURTSY_LUNGES] },
  { title: 'Jumping jacks', moves: [JUMPING_JACKS, STEP_JACKS] },
  { title: 'Push-ups', moves: [PUSH_UPS, KNEE_PUSH_UPS] },
  { title: 'Glutes & calves', moves: [GLUTE_BRIDGES, CALF_RAISES] },
  { title: 'Planks', moves: [PLANK_HOLD, KNEE_PLANK_HOLD, FOREARM_PLANK_HOLD] },
];

export const MOVES: Step[] = MOVE_GROUPS.flatMap((group) => group.moves);

export function moveById(id: string | null | undefined): Step | undefined {
  return MOVES.find((move) => move.id === id);
}

/** One move as a session, so the workout screens run it as they always have. */
export function singleMove(step: Step): Session {
  return { id: step.id, title: step.name, steps: [step] };
}

/** A keyframe between a and b at t (0..1). */
export function blend(a: Keyframe, b: Keyframe, t: number): number[] {
  return a.map((v, i) => v + (b[i]! - v) * t);
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

/** A move the phone's camera can judge rep by rep. */
export type JudgedStep = Extract<Step, { kind: 'reps' }> & { engine: string };

export function isJudged(step: Step): step is JudgedStep {
  return step.kind === 'reps' && step.engine !== undefined;
}

/** The moves of a session the camera checks, in order (holds and calf raises are follow-along only). */
export function judgedSteps(session: Session): JudgedStep[] {
  return session.steps.filter(isJudged);
}

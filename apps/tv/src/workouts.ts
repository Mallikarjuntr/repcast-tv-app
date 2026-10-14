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

export type Step =
  | {
      kind: 'reps';
      id: string;
      name: string;
      sets: number;
      reps: number;
      /** Seconds for the down and up halves of each rep: the tempo beat. */
      beat: { down: number; up: number };
      restSeconds: number;
      /** Spoken at the start of the set, then the down and up cues alternate on screen. */
      cues: { start: string; down: string; up: string };
      demo: Demo;
    }
  | {
      kind: 'timed';
      id: string;
      name: string;
      seconds: number;
      cue: string;
      /** Seconds per demo cycle; 0 holds the pose still. */
      cycle: number;
      demo: Demo;
    };

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

// Standing, front view.
const STAND: Keyframe = [0.5, 0.21, 0.42, 0.3, 0.58, 0.3, 0.4, 0.41, 0.6, 0.41, 0.42, 0.51, 0.58, 0.51, 0.45, 0.5, 0.55, 0.5, 0.43, 0.69, 0.57, 0.69, 0.44, 0.87, 0.56, 0.87];
// Bottom of a squat: hips down and back, arms forward for balance.
const SQUAT: Keyframe = [0.5, 0.39, 0.42, 0.47, 0.58, 0.47, 0.4, 0.5, 0.6, 0.5, 0.42, 0.5, 0.58, 0.5, 0.45, 0.65, 0.55, 0.65, 0.39, 0.69, 0.61, 0.69, 0.44, 0.87, 0.56, 0.87];
// Bottom of a lunge: right knee towards the floor, left knee over the front foot.
const LUNGE: Keyframe = [0.5, 0.34, 0.42, 0.43, 0.58, 0.43, 0.41, 0.54, 0.59, 0.54, 0.43, 0.63, 0.57, 0.63, 0.45, 0.63, 0.55, 0.63, 0.42, 0.74, 0.58, 0.82, 0.43, 0.88, 0.6, 0.9];
// Jumping jack, open: arms overhead, feet wide.
const JACK_OPEN: Keyframe = [0.5, 0.21, 0.42, 0.3, 0.58, 0.3, 0.33, 0.21, 0.67, 0.21, 0.3, 0.1, 0.7, 0.1, 0.45, 0.5, 0.55, 0.5, 0.38, 0.69, 0.62, 0.69, 0.33, 0.87, 0.67, 0.87];
// Marching: left knee up / right knee up.
const MARCH_L: Keyframe = [0.5, 0.21, 0.42, 0.3, 0.58, 0.3, 0.4, 0.41, 0.6, 0.38, 0.43, 0.5, 0.6, 0.45, 0.45, 0.5, 0.55, 0.5, 0.43, 0.6, 0.57, 0.69, 0.44, 0.75, 0.56, 0.87];
const MARCH_R: Keyframe = [0.5, 0.21, 0.42, 0.3, 0.58, 0.3, 0.4, 0.38, 0.6, 0.41, 0.4, 0.45, 0.57, 0.5, 0.45, 0.5, 0.55, 0.5, 0.43, 0.69, 0.57, 0.6, 0.44, 0.87, 0.56, 0.75];
// Reaching up for the cool-down stretch.
const REACH: Keyframe = [0.5, 0.21, 0.42, 0.3, 0.58, 0.3, 0.43, 0.19, 0.57, 0.19, 0.46, 0.08, 0.54, 0.08, 0.45, 0.5, 0.55, 0.5, 0.43, 0.69, 0.57, 0.69, 0.44, 0.87, 0.56, 0.87];
// High plank, seen from the side: hands under shoulders, one straight line to the heels (floor at y 0.7).
const PLANK: Keyframe = [0.17, 0.47, 0.25, 0.5, 0.26, 0.5, 0.25, 0.6, 0.26, 0.6, 0.25, 0.7, 0.26, 0.7, 0.45, 0.555, 0.46, 0.555, 0.64, 0.61, 0.65, 0.61, 0.82, 0.665, 0.83, 0.665];

export const LEGS_GENTLY: Session = {
  id: 'legs-gently',
  title: 'Legs,\n',
  titleItalic: 'gently.',
  summary: 'Squats, lunges and jumping jacks — a march to warm up, a plank to finish, and a slow beat for your knees.',
  coachNote: "go slow on the way down —\nI'll do the counting.",
  steps: [
    { kind: 'timed', id: 'warm-up', name: 'March on the spot', seconds: 40, cue: 'March on the spot — easy pace, arms swinging', cycle: 1.2, demo: { a: MARCH_L, b: MARCH_R, aspect: FRONT } },
    {
      kind: 'reps',
      id: 'squat',
      name: 'Squats',
      sets: 3,
      reps: 12,
      beat: { down: 2, up: 1.5 },
      restSeconds: 30,
      cues: { start: 'Squats. Twelve reps. Follow the beat.', down: 'sit back… chest up', up: 'drive up through your heels' },
      demo: { a: STAND, b: SQUAT, aspect: FRONT },
    },
    {
      kind: 'reps',
      id: 'lunge',
      name: 'Lunges',
      sets: 2,
      reps: 10,
      beat: { down: 2, up: 1.5 },
      restSeconds: 30,
      cues: { start: 'Lunges. Ten reps. Swap legs whenever you like.', down: 'back knee towards the floor', up: 'push through the front heel' },
      demo: { a: STAND, b: LUNGE, aspect: FRONT },
    },
    {
      kind: 'reps',
      id: 'jumping-jack',
      name: 'Jumping jacks',
      sets: 2,
      reps: 20,
      beat: { down: 0.5, up: 0.5 },
      restSeconds: 20,
      cues: { start: 'Jumping jacks. Twenty. Light on your feet.', down: 'arms up, feet wide', up: 'back together' },
      demo: { a: STAND, b: JACK_OPEN, aspect: FRONT },
    },
    { kind: 'timed', id: 'plank', name: 'Plank', seconds: 30, cue: 'Hold a straight line from shoulders to heels', cycle: 0, demo: { a: PLANK, b: PLANK, aspect: 1, fitBox: true } },
    { kind: 'timed', id: 'cool-down', name: 'Reach and breathe', seconds: 30, cue: 'Reach up tall, then let your arms float down', cycle: 6, demo: { a: STAND, b: REACH, aspect: FRONT } },
  ],
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

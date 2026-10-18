// The 3D trainer clips rendered by tools/trainer/render.py, by move id. Each loops exactly one beat
// of its move (holds loop their own cycle). Moves without a clip use the drawn figure.
const SQUAT = require('../assets/trainer/squat.mp4');

export const TRAINER_CLIPS: Record<string, number> = {
  squat: SQUAT,
  'half-squat': require('../assets/trainer/half-squat.mp4'),
  'sumo-squat': require('../assets/trainer/sumo-squat.mp4'),
  // Each lunge shows its own footwork: step forward, step back, or feet staying split.
  lunge: require('../assets/trainer/lunge.mp4'),
  'reverse-lunge': require('../assets/trainer/reverse-lunge.mp4'),
  'split-squat': require('../assets/trainer/split-squat.mp4'),
  'jumping-jack': require('../assets/trainer/jumping-jack.mp4'),
  'step-jack': require('../assets/trainer/step-jack.mp4'),
  plank: require('../assets/trainer/plank.mp4'),
  'knee-plank': require('../assets/trainer/knee-plank.mp4'),
  'forearm-plank': require('../assets/trainer/forearm-plank.mp4'),
  // Low-impact moves.
  'calf-raise': require('../assets/trainer/calf-raise.mp4'),
  'wall-sit': require('../assets/trainer/wall-sit.mp4'),
  'curtsy-lunge': require('../assets/trainer/curtsy-lunge.mp4'),
  // Floor moves, side-on.
  'push-up': require('../assets/trainer/push-up.mp4'),
  'knee-push-up': require('../assets/trainer/knee-push-up.mp4'),
  'glute-bridge': require('../assets/trainer/glute-bridge.mp4'),
};

/** Shown during rests: the trainer stands at ease, breathing, so the screen never looks like work. */
export const REST_CLIP: number = require('../assets/trainer/rest.mp4');

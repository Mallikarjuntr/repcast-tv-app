// The 3D trainer clips rendered by tools/trainer/render.py, by move id. Each loops exactly one beat
// of its move (holds and warm-ups loop their own cycle). Moves without a clip use the drawn figure.
const SQUAT = require('../assets/trainer/squat.mp4');
const LUNGE = require('../assets/trainer/lunge.mp4');

export const TRAINER_CLIPS: Record<string, number> = {
  march: require('../assets/trainer/march.mp4'),
  'step-touch': require('../assets/trainer/step-touch.mp4'),
  'high-knees': require('../assets/trainer/high-knees.mp4'),
  squat: SQUAT,
  'half-squat': require('../assets/trainer/half-squat.mp4'),
  'sumo-squat': require('../assets/trainer/sumo-squat.mp4'),
  // Lunges are shown as a split stance lowering straight down, which is also how the reverse lunge
  // and split squat look at the bottom of each rep.
  lunge: LUNGE,
  'reverse-lunge': LUNGE,
  'split-squat': LUNGE,
  'jumping-jack': require('../assets/trainer/jumping-jack.mp4'),
  'step-jack': require('../assets/trainer/step-jack.mp4'),
  plank: require('../assets/trainer/plank.mp4'),
  'knee-plank': require('../assets/trainer/knee-plank.mp4'),
  'cool-down': require('../assets/trainer/reach.mp4'),
  'side-bend': require('../assets/trainer/side-bend.mp4'),
};

/** Shown during rests: the trainer stands at ease, breathing, so the screen never looks like work. */
export const REST_CLIP: number = require('../assets/trainer/rest.mp4');

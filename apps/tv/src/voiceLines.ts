// Everything the coach says aloud, in follow-along and camera-coached workouts. Kept free of
// runtime imports so tools/voice/phrases.mjs can list every line for pre-recording with Amazon Polly.
import type { FramingHint } from '@spotter/shared';

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];

/** The highest rep count spoken as a word (and pre-recorded). */
export const MAX_SPOKEN_COUNT = NUMBER_WORDS.length - 1;

export const FINISH_LINE = "That's the session. Well done.";

export function countLine(rep: number): string {
  return NUMBER_WORDS[rep] ?? String(rep);
}

/** Said when a set starts: the move's own intro for set 1, then "Set 2. 12 reps." */
export function setIntroLine(step: { kind: 'reps'; reps: number; cues: { start: string } }, set: number): string {
  return set === 0 ? step.cues.start : `Set ${set + 1}. ${step.reps} reps.`;
}

/** Said when a rest starts; `next` is "set 2" or the next move's name. */
export function restLine(next: string): string {
  return `Rest. Next, ${next.toLowerCase()}.`;
}

/** Camera coaching: said at the start of the first set (later sets use setIntroLine). */
export function coachIntroLine(name: string, reps: number): string {
  const count = countLine(reps);
  return `${name}. ${count.charAt(0).toUpperCase()}${count.slice(1)} reps. At your own pace.`;
}

/** Said before the reason when an attempt doesn't count. */
export const NO_REP_LINE = 'No rep.';

/** Said when a new pairing screen opens: the live picture only reaches the TV across the home network. */
export const WIFI_LINE = 'Scan the code with your phone. Keep your phone and TV on the same Wi-Fi.';

/** Said once when the phone links on the pairing screen. */
export const PHONE_LINKED_LINE = 'Phone connected. Now step into view.';

/** Said when everything the exercise needs is in view. */
export const READY_LINE = "I can see you. Press start when you're ready.";

/** Getting into frame, from the person's own point of view (the phone works out which way). */
export const HINT_LINES: Record<FramingHint, string> = {
  'step-in': "I can't see you. Step into view of the phone.",
  'step-back': 'Step back a little, so I can see all of you.',
  'come-closer': 'Come a little closer to the phone.',
  'move-left': 'Move a little to your left.',
  'move-right': 'Move a little to your right.',
  'turn-phone': 'Turn the phone about forty-five degrees, so I can see both legs.',
};

/**
 * Rep advice the movement engine gives for any exercise (spotter-movement rep-detector.ts); each
 * exercise's own cues are read from its definition by tools/voice/phrases.mjs. Keep in sync.
 */
export const ENGINE_CUES = ['You moved off your spot — stay in one place for each rep, and keep the phone still', 'Finish each rep standing tall', 'Stay down in position for the whole rep'];

/** Stable id for a spoken line, used as its audio file name. */
export function voiceId(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32)
    .replace(/-$/, '');
  return `${slug}-${hash.toString(36)}`;
}

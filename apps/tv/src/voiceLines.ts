// Everything the coach says aloud in a follow-along workout. Kept free of imports so
// tools/voice/phrases.mjs can list every line for pre-recording with Amazon Polly.

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

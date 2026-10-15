import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';
import { CLIPS } from './voiceClips';
import { voiceId } from './voiceLines';

let player: AudioPlayer | null = null;
/** Lines waiting to follow the one playing ("seven" … "push your knees out"); kept short so advice stays current. */
const queue: number[] = [];
const MAX_QUEUED = 2;
/** When the playing line started; a line still "playing" after this long is assumed finished. */
let playingSince: number | null = null;
const MAX_LINE_MS = 5000;

function busy(): boolean {
  return playingSince !== null && Date.now() - playingSince < MAX_LINE_MS;
}

function play(clip: number): void {
  if (!player) {
    player = createAudioPlayer(clip);
    player.addListener('playbackStatusUpdate', (status) => {
      if (!status.didJustFinish) return;
      playingSince = null;
      const next = queue.shift();
      if (next !== undefined) play(next);
    });
  } else {
    player.replace(clip);
  }
  playingSince = Date.now();
  player.play();
}

/**
 * Speak a coach line. Lines are pre-recorded with Amazon Polly and bundled in the app, because
 * the Fire TV Stick's own speech engine accepts requests but plays nothing. A line without a
 * recording falls back to the device's speech engine.
 *
 * A new line cuts off the current one, unless `after` is set: then it waits its turn.
 */
export function say(text: string, { after = false }: { after?: boolean } = {}): void {
  const clip = CLIPS[voiceId(text)];
  if (clip === undefined) {
    if (__DEV__) console.warn(`No recording for "${text}" — run tools/voice to add it.`);
    if (!after) Speech.stop().catch(() => {});
    Speech.speak(text, { language: 'en-IN' });
    return;
  }
  if (after && busy()) {
    queue.push(clip);
    if (queue.length > MAX_QUEUED) queue.shift();
    return;
  }
  queue.length = 0;
  play(clip);
}

/** Stop whatever the coach is saying (pause, leaving the workout). */
export function hush(): void {
  queue.length = 0;
  playingSince = null;
  player?.pause();
  Speech.stop().catch(() => {});
}

import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';
import { CLIPS } from './voiceClips';
import { voiceId } from './voiceLines';

let player: AudioPlayer | null = null;

/**
 * Speak a coach line. Lines are pre-recorded with Amazon Polly and bundled in the app, because
 * the Fire TV Stick's own speech engine accepts requests but plays nothing. A line without a
 * recording falls back to the device's speech engine.
 */
export function say(text: string): void {
  const clip = CLIPS[voiceId(text)];
  if (clip === undefined) {
    if (__DEV__) console.warn(`No recording for "${text}" — run tools/voice to add it.`);
    Speech.stop().catch(() => {});
    Speech.speak(text, { language: 'en-IN' });
    return;
  }
  if (!player) player = createAudioPlayer(clip);
  else player.replace(clip);
  player.play();
}

/** Stop whatever the coach is saying (pause, leaving the workout). */
export function hush(): void {
  player?.pause();
  Speech.stop().catch(() => {});
}

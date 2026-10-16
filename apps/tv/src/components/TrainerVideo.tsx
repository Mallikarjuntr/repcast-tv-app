import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect } from 'react';
import { colors } from '../theme';

/** How far the trainer may drift from the beat before we nudge it back, in seconds. */
const MAX_DRIFT_S = 0.15;
const CHECK_MS = 250;

/** Where the trainer should be: seconds into its loop, 'hold' (wait at the start), or null (loop freely). */
export type TrainerPosition = number | 'hold' | null;

/**
 * The 3D trainer: a pre-rendered looping clip of the move (tools/trainer), drawn in the app's
 * studio style (pale figure on the panel colour). For moves on a beat, `position` keeps the trainer in step with the counting;
 * holds and previews just loop. Remount (key) it to change clips.
 */
export function TrainerVideo({ clip, paused, position }: { clip: number; paused: boolean; position: () => TrainerPosition }) {
  const player = useVideoPlayer(clip, (p) => {
    p.loop = true;
    p.muted = true;
    // Never take audio focus from the coach's voice.
    p.audioMixingMode = 'mixWithOthers';
  });

  useEffect(() => {
    const sync = () => {
      const target = paused ? 'hold-here' : position();
      if (target === 'hold-here') {
        if (player.playing) player.pause();
        return;
      }
      if (target === 'hold') {
        if (player.playing) player.pause();
        if (player.currentTime > 0.05) player.currentTime = 0;
        return;
      }
      if (!player.playing) player.play();
      const duration = player.duration;
      if (target === null || !duration) return;
      const want = target % duration;
      const off = Math.abs(player.currentTime - want);
      // Correct drift from loop seams or a slow frame, measured the short way round the loop.
      if (Math.min(off, duration - off) > MAX_DRIFT_S) player.currentTime = want;
    };
    sync();
    const timer = setInterval(sync, CHECK_MS);
    return () => clearInterval(timer);
  }, [player, paused, position]);

  // The panel colour behind the video and no black "shutter" before the first frame, so it blends into the panel.
  return (
    <VideoView
      player={player}
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentFit="contain"
      nativeControls={false}
      useExoShutter={false}
    />
  );
}

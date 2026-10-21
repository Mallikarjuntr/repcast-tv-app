import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { colors, useScale } from '../theme';
import { PanelTag } from './Studio';

/** How long each move stays on before the next one, at the least; it changes when its loop comes round. */
const SHOW_MS = 4000;
const CHECK_MS = 100;

export type ReelItem = { clip: number; name: string };

/**
 * The 3D trainer running through every move in turn, each for a few reps, then round again. One
 * player swaps the clip when the current loop restarts, so a move is never cut off mid-rep and the
 * panel never flashes between moves (a remount would show the empty panel for a frame).
 */
export function TrainerReel({ reel }: { reel: ReelItem[] }) {
  const s = useScale();
  const [index, setIndex] = useState(0);
  const player = useVideoPlayer(reel[0]!.clip, (p) => {
    p.loop = true;
    p.muted = true;
    // Never take audio focus from the coach's voice.
    p.audioMixingMode = 'mixWithOthers';
    p.play();
  });

  useEffect(() => {
    let at = 0;
    let shownAt = Date.now();
    let last = 0;
    const timer = setInterval(() => {
      const t = player.currentTime;
      const wrapped = t < last; // the loop came back to its start
      last = t;
      const age = Date.now() - shownAt;
      // Change at a loop seam; if the clock never moves (a stalled clip), change anyway.
      if (age < SHOW_MS || (!wrapped && age < SHOW_MS * 2)) return;
      at = (at + 1) % reel.length;
      player.replace(reel[at]!.clip);
      player.play();
      shownAt = Date.now();
      last = 0;
      setIndex(at);
    }, CHECK_MS);
    return () => clearInterval(timer);
  }, [player, reel]);

  return (
    <View style={{ flex: 1 }}>
      {/* The panel colour behind the video and no black "shutter" before the first frame, so it blends into the panel. */}
      <VideoView player={player} style={{ flex: 1, backgroundColor: colors.surface }} contentFit="contain" nativeControls={false} useExoShutter={false} />
      <View style={{ position: 'absolute', left: s(14), bottom: s(12) }}>
        <PanelTag>{reel[index]!.name.toUpperCase()}</PanelTag>
      </View>
    </View>
  );
}

import { useEffect, useState } from 'react';
import { createPoseFeed, type PoseFeed } from './poseFeed';
import { VideoReceiver, type VideoSnapshot } from './videoReceiver';

/** After the last screen lets go, the link stays up this long, so Pair → Live doesn't reconnect. */
const RELEASE_MS = 5000;

const shared = new Map<string, { receiver: VideoReceiver; users: number; release?: ReturnType<typeof setTimeout> }>();

const NO_VIDEO: VideoSnapshot = { state: 'waiting', streamUrl: null };
const NO_POSE = createPoseFeed();

/**
 * The phone's live camera for a session. Screens on the same session share one VideoReceiver,
 * so moving from pairing to the workout keeps the picture without a new connection.
 */
export function useVideoReceiver(channel: string | null): VideoSnapshot & { pose: PoseFeed } {
  const [snapshot, setSnapshot] = useState<VideoSnapshot>(NO_VIDEO);
  const [pose, setPose] = useState<PoseFeed>(NO_POSE);

  useEffect(() => {
    if (!channel) return;
    let entry = shared.get(channel);
    if (!entry) {
      entry = { receiver: new VideoReceiver(channel), users: 0 };
      shared.set(channel, entry);
    }
    const held = entry;
    clearTimeout(held.release);
    held.users += 1;
    setSnapshot(held.receiver.snapshot);
    setPose(held.receiver.pose);
    const unsubscribe = held.receiver.subscribe(setSnapshot);
    return () => {
      unsubscribe();
      held.users -= 1;
      if (held.users === 0) {
        held.release = setTimeout(() => {
          held.receiver.close();
          shared.delete(channel);
        }, RELEASE_MS);
      }
    };
  }, [channel]);

  return channel ? { ...snapshot, pose } : { ...NO_VIDEO, pose: NO_POSE };
}

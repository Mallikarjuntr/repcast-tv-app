import type { PoseFrame } from './components/PoseFigure';

export interface PoseFeed {
  getPose: () => { frame: PoseFrame; at: number } | null;
  subscribePose: (listener: () => void) => () => void;
  push: (frame: PoseFrame) => void;
}

/**
 * The latest outline from the phone, kept out of React state (it arrives ~12 times a second):
 * a panel subscribes and redraws itself. Same shape as useLiveWorkout's getPose/subscribePose.
 */
export function createPoseFeed(): PoseFeed {
  let latest: { frame: PoseFrame; at: number } | null = null;
  const listeners = new Set<() => void>();
  return {
    getPose: () => latest,
    subscribePose: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    push: (frame) => {
      latest = { frame, at: Date.now() };
      listeners.forEach((listener) => listener());
    },
  };
}

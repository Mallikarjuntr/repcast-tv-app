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

export type PoseSource = Pick<PoseFeed, 'getPose' | 'subscribePose'>;

/** Whichever source has the newest frame: the direct video link when it's up, else the session channel. */
export function latestOf(...sources: PoseSource[]): PoseSource {
  return {
    getPose: () =>
      sources.reduce<ReturnType<PoseFeed['getPose']>>((best, source) => {
        const pose = source.getPose();
        return pose && (!best || pose.at > best.at) ? pose : best;
      }, null),
    subscribePose: (listener) => {
      const offs = sources.map((source) => source.subscribePose(listener));
      return () => offs.forEach((off) => off());
    },
  };
}

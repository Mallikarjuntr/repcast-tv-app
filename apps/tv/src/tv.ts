import * as RN from 'react-native';
import type { PressableStateCallbackType } from 'react-native';

/**
 * react-native-tvos passes `focused` to Pressable's style and children callbacks at runtime, but its
 * TV type augmentation doesn't merge into the public Pressable types, so read it through this helper.
 */
export function isFocused(state: PressableStateCallbackType): boolean {
  return (state as PressableStateCallbackType & { focused?: boolean }).focused === true;
}

/** Remote-control event from react-native-tvos (eventType is e.g. 'select', 'playPause', 'left'). */
export interface TVRemoteEvent {
  eventType: string;
  eventKeyAction?: number;
}

/**
 * react-native-tvos's remote-control hook. It exists at runtime on `react-native`, but (like
 * `focused` above) its TV typings don't reach the public types, so it is re-exported here typed.
 */
export const useTVEventHandler = (RN as unknown as { useTVEventHandler: (handler: (event: TVRemoteEvent) => void) => void }).useTVEventHandler;

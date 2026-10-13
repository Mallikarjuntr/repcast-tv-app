import type { PressableStateCallbackType } from 'react-native';

/**
 * react-native-tvos passes `focused` to Pressable's style and children callbacks at runtime, but its
 * TV type augmentation doesn't merge into the public Pressable types, so read it through this helper.
 */
export function isFocused(state: PressableStateCallbackType): boolean {
  return (state as PressableStateCallbackType & { focused?: boolean }).focused === true;
}

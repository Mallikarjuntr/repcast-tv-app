import { Text, View } from 'react-native';
import { colors, fonts, PROFILE_COLOURS, useScale } from '../theme';

/** Each person's colour, by the order they were added, so it stays the same everywhere. */
export function profileColour(index: number): string {
  return PROFILE_COLOURS[Math.max(0, index) % PROFILE_COLOURS.length]!;
}

/** A person's initial on their colour. */
export function Avatar({ name, colour, size }: { name: string; colour: string; size: number }) {
  const s = useScale();
  return (
    <View style={{ width: s(size), height: s(size), borderRadius: s(size / 2), backgroundColor: colour, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.sansHeavy, fontSize: s(size * 0.47), color: colors.text }}>{name.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

import { Pressable, Text } from 'react-native';
import { colors, fonts, useScale } from '../theme';
import { isFocused } from '../tv';

interface FocusButtonProps {
  label: string;
  onPress: () => void;
  /** `solid` is a boxed button; `link` is underlined text. Both turn highlighter yellow when focused. */
  variant?: 'solid' | 'link';
  preferredFocus?: boolean;
  /** Visual size on the 1280-wide design canvas. */
  fontSize?: number;
}

export function FocusButton({ label, onPress, variant = 'solid', preferredFocus, fontSize = 24 }: FocusButtonProps) {
  const s = useScale();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hasTVPreferredFocus={preferredFocus}
      style={(state) => {
        const focused = isFocused(state);
        return variant === 'solid'
          ? {
              backgroundColor: focused ? colors.highlighter : 'transparent',
              borderColor: colors.ink,
              borderWidth: s(2.5),
              borderRadius: s(3),
              paddingVertical: s(16),
              paddingHorizontal: s(30),
              transform: [{ scale: focused ? 1.04 : 1 }],
            }
          : {
              backgroundColor: focused ? colors.highlighter : 'transparent',
              borderBottomColor: colors.ink,
              borderBottomWidth: s(2),
              paddingVertical: s(6),
              paddingHorizontal: s(focused ? 8 : 2),
            };
      }}
    >
      <Text style={{ fontFamily: variant === 'solid' ? fonts.sansBold : fonts.sansMedium, fontSize: s(fontSize), color: colors.ink }}>
        {label}
      </Text>
    </Pressable>
  );
}

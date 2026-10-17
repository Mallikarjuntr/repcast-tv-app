import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, useScale } from '../theme';
import { isFocused } from '../tv';

/**
 * `primary` is the one thing to do on a screen (orange), `secondary` a dark chip, `light` a cream
 * chip for controls over a workout (Pause), `quiet` plain text. Focus adds a cream ring and a lift.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'light' | 'quiet';

const LOOK: Record<ButtonVariant, { bg: string; fg: string; font: string }> = {
  primary: { bg: colors.accent, fg: colors.onAccent, font: fonts.sansHeavy },
  secondary: { bg: colors.raised, fg: colors.text, font: fonts.sansBold },
  light: { bg: colors.text, fg: colors.bg, font: fonts.sansHeavy },
  quiet: { bg: 'transparent', fg: colors.text, font: fonts.sansSemi },
};

interface FocusButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /** `compact` for header controls (Pause, Done with this). */
  size?: 'regular' | 'compact';
  /** A play triangle before the label, for the button that starts a workout. */
  play?: boolean;
  /** A left chevron before the label, for Back. */
  back?: boolean;
  preferredFocus?: boolean;
}

export function FocusButton({ label, onPress, variant = 'primary', size = 'regular', play, back, preferredFocus }: FocusButtonProps) {
  const s = useScale();
  const look = LOOK[variant];
  const compact = size === 'compact';
  const fontSize = compact ? 18 : variant === 'primary' ? 22 : 20;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hasTVPreferredFocus={preferredFocus}
      style={(state) => {
        const focused = isFocused(state);
        return {
          // The ring sits a few pixels outside the button, like a CSS outline with an offset.
          borderRadius: s(compact ? 13 : 15),
          borderWidth: s(3),
          borderColor: focused ? (variant === 'light' ? colors.accent : colors.text) : 'transparent',
          padding: s(3),
          transform: [{ scale: focused ? 1.04 : 1 }],
        };
      }}
    >
      {(state) => {
        const focused = isFocused(state);
        return (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: s(12),
              backgroundColor: variant === 'quiet' && focused ? colors.raised : look.bg,
              borderRadius: s(compact ? 9 : 11),
              paddingVertical: s(compact ? 9 : 15),
              paddingHorizontal: s(compact ? 18 : variant === 'quiet' ? 14 : 26),
            }}
          >
            {play ? (
              <Svg width={s(18)} height={s(18)} viewBox="0 0 18 18">
                <Path d="M4 2 L16 9 L4 16 Z" fill={look.fg} />
              </Svg>
            ) : null}
            {back ? (
              <Svg width={s(14)} height={s(16)} viewBox="0 0 14 16">
                <Path d="M10 2 L3 8 L10 14" fill="none" stroke={look.fg} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            ) : null}
            <Text
              style={{
                fontFamily: look.font,
                fontSize: s(fontSize),
                color: look.fg,
                textDecorationLine: variant === 'quiet' && !focused ? 'underline' : 'none',
              }}
            >
              {label}
            </Text>
          </View>
        );
      }}
    </Pressable>
  );
}

/**
 * The on-screen way back, top right of a screen's header. The remote's BACK key does the same;
 * this is for people who look for a button.
 */
export function BackButton({ onPress, preferredFocus }: { onPress: () => void; preferredFocus?: boolean }) {
  return <FocusButton label="Back" onPress={onPress} variant="secondary" size="compact" back preferredFocus={preferredFocus} />;
}

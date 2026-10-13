import { Text, View } from 'react-native';
import { FocusButton } from '../components/FocusButton';
import { Headline, Kicker, PenNote } from '../components/Type';
import { colors, fonts, useScale } from '../theme';

/** Stand-in for screens still being built, so every button leads somewhere during development. */
export function NextUpScreen({ title, detail, onBack }: { title: string; detail: string; onBack: () => void }) {
  const s = useScale();
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper, paddingHorizontal: s(64), paddingVertical: s(56), gap: s(24) }}>
      <Kicker>COMING NEXT</Kicker>
      <Headline lead={`${title} `} italic="is on its way." size={72} />
      <Text style={{ fontFamily: fonts.sans, fontSize: s(24), lineHeight: s(35), color: colors.inkSoft, maxWidth: s(760) }}>{detail}</Text>
      <PenNote arrow={false}>press BACK or OK to return</PenNote>
      <View style={{ flexDirection: 'row' }}>
        <FocusButton label="Back" onPress={onBack} preferredFocus />
      </View>
    </View>
  );
}

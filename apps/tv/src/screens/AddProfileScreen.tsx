import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { FocusButton } from '../components/FocusButton';
import { Headline, Kicker, PenNote } from '../components/Type';
import { colors, fonts, useScale } from '../theme';

/** A new person on this TV: just a name (typed with the Fire TV keyboard or the Fire TV phone app). */
export function AddProfileScreen({ onSave, onCancel }: { onSave: (name: string) => void; onCancel: () => void }) {
  const s = useScale();
  const [name, setName] = useState('');
  const [focused, setFocused] = useState(false);
  const clean = name.trim();

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper, paddingTop: s(40), paddingHorizontal: s(64), paddingBottom: s(36), gap: s(28) }}>
      <View style={{ gap: s(10) }}>
        <Kicker>ADD SOMEONE</Kicker>
        <Headline lead="What should I " italic="call you?" size={84} />
      </View>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Your name"
        placeholderTextColor={colors.faint}
        maxLength={20}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={() => clean && onSave(clean)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        // Straight to typing: on a TV the only thing to do here is enter a name.
        autoFocus
        hasTVPreferredFocus
        style={{
          width: s(620),
          fontFamily: fonts.display,
          fontSize: s(48),
          color: colors.ink,
          paddingVertical: s(14),
          paddingHorizontal: s(20),
          borderWidth: s(2.5),
          borderColor: colors.ink,
          backgroundColor: focused ? colors.highlighter : colors.paperBright,
        }}
      />
      <Text style={{ fontFamily: fonts.sans, fontSize: s(20), color: colors.inkSoft }}>Type with the remote or the Fire TV app on your phone. They'll get their own streak, history and swaps.</Text>
      <View style={{ flexDirection: 'row', gap: s(28), alignItems: 'center' }}>
        {clean ? <FocusButton label={`Save ${clean}`} onPress={() => onSave(clean)} /> : null}
        <FocusButton label="Cancel" onPress={onCancel} variant="link" fontSize={20} />
      </View>
      <View style={{ marginTop: 'auto' }}>
        <PenNote arrow={false} size={24}>
          names stay on this TV — no account, no sign-in
        </PenNote>
      </View>
    </View>
  );
}

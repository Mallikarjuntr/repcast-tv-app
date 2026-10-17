import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { FocusButton } from '../components/FocusButton';
import { Headline, Kicker, Note, Wordmark } from '../components/Type';
import { colors, fonts, useScale } from '../theme';

/** A new person on this TV: just a name (typed with the Fire TV keyboard or the Fire TV phone app). */
export function AddProfileScreen({ onSave, onCancel }: { onSave: (name: string) => void; onCancel: () => void }) {
  const s = useScale();
  const [name, setName] = useState('');
  const [focused, setFocused] = useState(false);
  const clean = name.trim();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: s(44), paddingHorizontal: s(64), paddingBottom: s(40) }}>
      <Wordmark />
      <View style={{ marginTop: s(56), gap: s(14) }}>
        <Kicker color={colors.accent}>ADD SOMEONE</Kicker>
        <Headline text="What should I call you?" size={92} />
      </View>
      <View style={{ marginTop: s(36), alignSelf: 'flex-start', borderRadius: s(20), borderWidth: s(3), borderColor: focused ? colors.accent : 'transparent', padding: s(3) }}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor={colors.dim}
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
            width: s(640),
            fontFamily: fonts.display,
            fontSize: s(44),
            color: colors.text,
            paddingVertical: s(16),
            paddingHorizontal: s(26),
            borderRadius: s(14),
            backgroundColor: colors.surface,
          }}
        />
      </View>
      <View style={{ marginTop: s(20), maxWidth: s(660) }}>
        <Note size={19}>Type with the remote or the Fire TV app on your phone. They'll get their own streak and history.</Note>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10), marginTop: 'auto', marginLeft: -s(6) }}>
        {clean ? <FocusButton label={`Add ${clean}`} onPress={() => onSave(clean)} /> : null}
        <FocusButton label="Cancel" onPress={onCancel} variant="secondary" />
      </View>
    </View>
  );
}

import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Avatar, profileColour } from '../components/Avatar';
import { BackButton } from '../components/FocusButton';
import { Headline, Kicker, Note, Wordmark } from '../components/Type';
import { lastSeen } from '../progress';
import { loadSessions, MAX_PROFILES, streakDays, type Profile, type SessionRecord } from '../storage';
import { colors, fonts, useScale } from '../theme';
import { isFocused } from '../tv';

function detail(sessions: SessionRecord[]): string {
  const seen = lastSeen(sessions);
  if (!seen) return 'New here';
  const streak = streakDays(sessions);
  // lastSeen says "Today", "Yesterday", "3 days ago" or a date; mid-sentence the first two read lower-case.
  const when = seen === 'Today' || seen === 'Yesterday' ? seen.toLowerCase() : seen;
  return streak > 1 ? `${streak} days in a row · trained ${when}` : `Last trained ${when}`;
}

/** A tile on the picker; the focused one lifts and gets a cream ring. */
function Tile({ accessibilityLabel, preferred, onPress, children }: { accessibilityLabel: string; preferred?: boolean; onPress: () => void; children: ReactNode }) {
  const s = useScale();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} hasTVPreferredFocus={preferred}>
      {(state) => {
        const focused = isFocused(state);
        return (
          <View style={{ borderRadius: s(24), borderWidth: s(3), borderColor: focused ? colors.text : 'transparent', padding: s(3), transform: [{ scale: focused ? 1.04 : 1 }] }}>
            <View style={{ width: s(250), height: s(250), borderRadius: s(18), backgroundColor: focused ? colors.surfaceHigh : colors.surface, padding: s(24), gap: s(10) }}>
              {children}
            </View>
          </View>
        );
      }}
    </Pressable>
  );
}

/**
 * "Who's training?" — everyone who trains on this TV keeps their own history and streak.
 * Nothing leaves the TV; no sign-in.
 */
export function ProfilesScreen({
  profiles,
  lastId,
  onChoose,
  onAdd,
  onBack,
}: {
  profiles: Profile[];
  lastId: string | null;
  onChoose: (profile: Profile) => void;
  onAdd: () => void;
  /** Only when opened from Home; at launch there's nowhere to go back to. */
  onBack?: () => void;
}) {
  const s = useScale();
  const [histories, setHistories] = useState<Record<string, SessionRecord[]>>({});
  useEffect(() => {
    void Promise.all(profiles.map(async (p) => [p.id, await loadSessions(p.id)] as const)).then((entries) => setHistories(Object.fromEntries(entries)));
  }, [profiles]);
  const preferredId = profiles.some((p) => p.id === lastId) ? lastId : profiles[0]?.id;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: s(44), paddingHorizontal: s(64), paddingBottom: s(40) }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Wordmark />
        {onBack ? <BackButton onPress={onBack} /> : null}
      </View>
      <View style={{ marginTop: s(56), gap: s(14) }}>
        <Kicker color={colors.accent}>WHO'S TRAINING?</Kicker>
        <Headline text="Pick your name" size={92} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(22), marginTop: s(40), marginLeft: -s(6) }}>
        {profiles.map((profile, i) => (
          <Tile key={profile.id} accessibilityLabel={`${profile.name} is training`} preferred={profile.id === preferredId} onPress={() => onChoose(profile)}>
            <Avatar name={profile.name} colour={profileColour(i)} size={84} />
            <Text style={{ fontFamily: fonts.display, fontSize: s(36), color: colors.text, marginTop: 'auto' }} numberOfLines={1}>
              {profile.name}
            </Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: s(16), color: colors.muted }} numberOfLines={2}>
              {detail(histories[profile.id] ?? [])}
            </Text>
          </Tile>
        ))}
        {profiles.length < MAX_PROFILES ? (
          <Tile accessibilityLabel="Add someone" onPress={onAdd}>
            <View style={{ width: s(84), height: s(84), borderRadius: s(42), backgroundColor: colors.raised, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.sans, fontSize: s(48), lineHeight: s(56), color: colors.textSoft }}>+</Text>
            </View>
            <Text style={{ fontFamily: fonts.display, fontSize: s(36), color: colors.text, marginTop: 'auto' }}>Add someone</Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: s(16), color: colors.muted }}>Their own streak and history</Text>
          </Tile>
        ) : null}
      </View>
      <View style={{ marginTop: 'auto' }}>
        <Note size={17} color={colors.faint}>
          Everyone keeps their own streak and history — all on this TV, no sign-in.
        </Note>
      </View>
    </View>
  );
}

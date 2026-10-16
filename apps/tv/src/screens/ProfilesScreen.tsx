import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Headline, Kicker, PenNote, Wordmark } from '../components/Type';
import { lastSeen } from '../progress';
import { loadSessions, MAX_PROFILES, type Profile, type SessionRecord } from '../storage';
import { colors, fonts, useScale } from '../theme';
import { isFocused } from '../tv';

/** Each person gets a mark of their own, so they find themselves at a glance. */
const MARK_COLOURS = [colors.highlighter, colors.pen, colors.ink, colors.pencil, colors.paperDeep, colors.inkSoft];

function ProfileCard({ profile, index, sessions, preferred, onPress }: { profile: Profile; index: number; sessions: SessionRecord[]; preferred: boolean; onPress: () => void }) {
  const s = useScale();
  const colour = MARK_COLOURS[index % MARK_COLOURS.length]!;
  const seen = lastSeen(sessions);
  const light = colour === colors.highlighter || colour === colors.paperDeep;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${profile.name} is training`} onPress={onPress} hasTVPreferredFocus={preferred}>
      {(state) => {
        const focused = isFocused(state);
        return (
          <View
            style={{
              width: s(220),
              alignItems: 'center',
              gap: s(12),
              paddingVertical: s(22),
              borderWidth: s(2.5),
              borderColor: focused ? colors.ink : 'transparent',
              backgroundColor: focused ? colors.highlighter : 'transparent',
              transform: [{ scale: focused ? 1.05 : 1 }],
            }}
          >
            <View style={{ width: s(120), height: s(120), borderRadius: s(60), backgroundColor: colour, borderWidth: s(2.5), borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.displayBold, fontSize: s(60), color: light ? colors.ink : colors.paper }}>{profile.name.charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={{ fontFamily: fonts.display, fontSize: s(30), color: colors.ink }} numberOfLines={1}>
              {profile.name}
            </Text>
            <Kicker size={13}>{seen ? `LAST · ${seen.toUpperCase()}` : 'NEW HERE'}</Kicker>
          </View>
        );
      }}
    </Pressable>
  );
}

/**
 * "Who's training?" — everyone who trains on this TV keeps their own history, streak and swaps.
 * Nothing leaves the TV; no sign-in.
 */
export function ProfilesScreen({ profiles, lastId, onChoose, onAdd }: { profiles: Profile[]; lastId: string | null; onChoose: (profile: Profile) => void; onAdd: () => void }) {
  const s = useScale();
  const [histories, setHistories] = useState<Record<string, SessionRecord[]>>({});
  useEffect(() => {
    void Promise.all(profiles.map(async (p) => [p.id, await loadSessions(p.id)] as const)).then((entries) => setHistories(Object.fromEntries(entries)));
  }, [profiles]);
  const preferredId = profiles.some((p) => p.id === lastId) ? lastId : profiles[0]?.id;

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper, paddingTop: s(40), paddingHorizontal: s(64), paddingBottom: s(36), gap: s(36) }}>
      <Wordmark />
      <View style={{ gap: s(10) }}>
        <Kicker>WHO'S TRAINING?</Kicker>
        <Headline lead="Pick your " italic="page." size={84} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(24), alignItems: 'flex-start' }}>
        {profiles.map((profile, i) => (
          <ProfileCard key={profile.id} profile={profile} index={i} sessions={histories[profile.id] ?? []} preferred={profile.id === preferredId} onPress={() => onChoose(profile)} />
        ))}
        {profiles.length < MAX_PROFILES ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Add someone" onPress={onAdd}>
            {(state) => {
              const focused = isFocused(state);
              return (
                <View style={{ width: s(220), alignItems: 'center', gap: s(12), paddingVertical: s(22), borderWidth: s(2.5), borderColor: focused ? colors.ink : 'transparent', backgroundColor: focused ? colors.highlighter : 'transparent' }}>
                  <View style={{ width: s(120), height: s(120), borderRadius: s(60), borderWidth: s(2.5), borderColor: colors.ink, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: fonts.display, fontSize: s(64), color: colors.ink, lineHeight: s(72) }}>+</Text>
                  </View>
                  <Text style={{ fontFamily: fonts.display, fontSize: s(30), color: colors.ink }}>Add someone</Text>
                  <Kicker size={13}>THEIR OWN STREAK</Kicker>
                </View>
              );
            }}
          </Pressable>
        ) : null}
      </View>
      <View style={{ marginTop: 'auto' }}>
        <PenNote arrow={false} size={24}>
          everyone keeps their own page — it all stays on this TV
        </PenNote>
      </View>
    </View>
  );
}

import type { Session as Pairing } from '@spotter/shared';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BackButton } from '../components/FocusButton';
import { PanelTag } from '../components/Studio';
import { TrainerVideo } from '../components/TrainerVideo';
import { Headline, Kicker, Note } from '../components/Type';
import type { Mode } from './ModesScreen';
import { colors, fonts, useScale } from '../theme';
import { TRAINER_CLIPS } from '../trainerClips';
import { isFocused } from '../tv';
import { useExerciseCommand } from '../useExerciseCommand';
import { estimateSeconds, isJudged, MOVE_GROUPS, singleMove, type Step } from '../workouts';

function amount(step: Step): string {
  return step.kind === 'reps' ? `${step.sets} × ${step.reps}` : `${step.seconds} s`;
}

function MoveCard({ step, preferredFocus, onFocus, onPress }: { step: Step; preferredFocus: boolean; onFocus: () => void; onPress: () => void }) {
  const s = useScale();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${step.name}, ${amount(step)}`} hasTVPreferredFocus={preferredFocus} onFocus={onFocus} onPress={onPress}>
      {(state) => {
        const focused = isFocused(state);
        return (
          <View
            style={{
              width: s(172),
              height: s(60),
              justifyContent: 'center',
              gap: s(2),
              paddingHorizontal: s(14),
              borderRadius: s(12),
              borderWidth: s(3),
              borderColor: focused ? colors.text : 'transparent',
              backgroundColor: focused ? colors.surfaceHigh : colors.surface,
              transform: [{ scale: focused ? 1.04 : 1 }],
            }}
          >
            <Text style={{ fontFamily: fonts.displaySemi, fontSize: s(20), color: colors.text }} numberOfLines={1}>
              {step.name}
            </Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: s(14), color: colors.muted }}>
              {amount(step)}
              {step.easier ? <Text style={{ fontFamily: fonts.sansBold, fontSize: s(11), letterSpacing: s(1.5), color: colors.accent }}>{'   EASIER'}</Text> : null}
            </Text>
          </View>
        );
      }}
    </Pressable>
  );
}

/**
 * Every move, in sections (squats, lunges, …), so a gentler version is right there next to the
 * classic one. With the camera, only the moves it can check rep by rep are offered.
 */
export function PickMoveScreen({
  mode,
  pairing,
  lastMoveId,
  onPick,
  onBack,
}: {
  mode: Mode;
  /** Camera mode after a move: the phone is still linked, so keep telling it the TV is here. */
  pairing: Pairing | null;
  lastMoveId: string | null;
  onPick: (step: Step) => void;
  onBack: () => void;
}) {
  const s = useScale();
  useExerciseCommand(pairing?.channel ?? null, { id: null, phase: 'pair' });
  const groups = useMemo(
    () => MOVE_GROUPS.map((group) => ({ ...group, moves: mode === 'coach' ? group.moves.filter(isJudged) : group.moves })).filter((group) => group.moves.length > 0),
    [mode],
  );
  const all = groups.flatMap((group) => group.moves);
  const initial = all.find((move) => move.id === lastMoveId) ?? all[0]!;
  const [focused, setFocused] = useState<Step>(initial);
  const freeLoop = useCallback(() => null, []);
  const clip = TRAINER_CLIPS[focused.id];
  const minutes = Math.max(1, Math.round(estimateSeconds(singleMove(focused)) / 60));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: s(32), paddingHorizontal: s(64), paddingBottom: s(24), gap: s(14) }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View style={{ gap: s(12) }}>
          <Kicker color={colors.accent}>{mode === 'coach' ? 'COACH ME ON CAMERA · EVERY REP CHECKED' : 'FOLLOW ALONG · WITH THE TRAINER'}</Kicker>
          <Headline text="Pick a move" size={56} />
        </View>
        <BackButton onPress={onBack} />
      </View>

      <View style={{ flex: 1, flexDirection: 'row', gap: s(24) }}>
        {/* No scroll view: every section fits, and UP from the top row reaches Back (a scroll view keeps D-pad focus inside itself). */}
        <View style={{ width: s(726), gap: s(10) }}>
          {groups.map((group) => (
            <View key={group.title} style={{ gap: s(6) }}>
              <Kicker size={12}>{group.title.toUpperCase()}</Kicker>
              <View style={{ flexDirection: 'row', gap: s(10) }}>
                {group.moves.map((move) => (
                  <MoveCard key={move.id} step={move} preferredFocus={move.id === initial.id} onFocus={() => setFocused(move)} onPress={() => onPick(move)} />
                ))}
              </View>
            </View>
          ))}
        </View>

        <View style={{ flex: 1, gap: s(12) }}>
          <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: s(20), overflow: 'hidden' }}>
            {clip !== undefined ? <TrainerVideo key={focused.id} clip={clip} paused={false} position={freeLoop} /> : null}
            <View style={{ position: 'absolute', top: s(14), left: s(16) }}>
              <PanelTag>LIKE THIS · {focused.name.toUpperCase()}</PanelTag>
            </View>
          </View>
          <Note size={18}>{focused.why}</Note>
          <Text style={{ fontFamily: fonts.sansSemi, fontSize: s(16), color: colors.muted }}>
            {focused.kind === 'reps' ? `${focused.sets} sets of ${focused.reps}` : `Hold for ${focused.seconds} seconds`} · about {minutes} min · press OK to start
          </Text>
        </View>
      </View>
    </View>
  );
}

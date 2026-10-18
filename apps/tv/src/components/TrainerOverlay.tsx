import { useEffect } from 'react';
import { BackHandler, Text, View } from 'react-native';
import { TRAINER_CLIPS } from '../trainerClips';
import { colors, fonts, useScale } from '../theme';
import { MOVES } from '../workouts';
import { FocusButton } from './FocusButton';
import { Card, PanelTag } from './Studio';
import { Headline, Kicker, Note } from './Type';
import { TrainerVideo } from './TrainerVideo';

const freeLoop = () => null;

/**
 * "Watch the trainer" over a live set: the move's 3D trainer clip and its cues, so someone unsure
 * how a move goes can check without leaving the workout. BACK or the button returns to the set.
 */
export function TrainerOverlay({ moveId, onClose }: { moveId: string; onClose: () => void }) {
  const s = useScale();
  const move = MOVES.find((m) => m.id === moveId || (m.kind === 'reps' && m.engine === moveId));
  const clip = TRAINER_CLIPS[move?.id ?? moveId];

  // Above the app's own BACK handling, which would leave the workout.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.bg, paddingTop: s(40), paddingHorizontal: s(64), paddingBottom: s(40), flexDirection: 'row', gap: s(40) }}>
      <View style={{ width: s(560), gap: s(18) }}>
        <Kicker color={colors.accent}>HOW IT GOES · YOUR SET IS PAUSED</Kicker>
        <Headline text={move?.name ?? 'This move'} size={84} />
        {move ? <Note size={22}>{move.why}</Note> : null}
        {move?.kind === 'reps' ? (
          <View style={{ gap: s(12), marginTop: s(8) }}>
            {[
              ['DOWN', move.cues.down],
              ['UP', move.cues.up],
            ].map(([label, text]) => (
              <Card key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: s(18), paddingVertical: s(16) }}>
                <Text style={{ fontFamily: fonts.display, fontSize: s(26), color: colors.accent, width: s(80) }}>{label}</Text>
                <Text style={{ flex: 1, fontFamily: fonts.sansSemi, fontSize: s(22), color: colors.text }}>{text}</Text>
              </Card>
            ))}
          </View>
        ) : null}
        <View style={{ marginTop: 'auto', flexDirection: 'row', marginLeft: -s(6) }}>
          <FocusButton label="Back to my set" onPress={onClose} preferredFocus />
        </View>
      </View>
      <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: s(20), overflow: 'hidden' }}>
        {clip !== undefined ? <TrainerVideo clip={clip} paused={false} position={freeLoop} /> : null}
        <View style={{ position: 'absolute', top: s(16), left: s(18) }}>
          <PanelTag>LIKE THIS</PanelTag>
        </View>
      </View>
    </View>
  );
}

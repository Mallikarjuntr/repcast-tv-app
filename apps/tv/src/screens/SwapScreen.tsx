import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { FocusButton } from '../components/FocusButton';
import { DemoFigure } from '../components/DemoFigure';
import { TrainerVideo } from '../components/TrainerVideo';
import { TRAINER_CLIPS } from '../trainerClips';
import { PanelTag } from '../components/Studio';
import { Headline, Kicker, Note } from '../components/Type';
import { colors, fonts, useScale } from '../theme';
import { isFocused } from '../tv';
import { SWAP_OPTIONS, type Session, type Step, type Swaps } from '../workouts';

function amount(step: Step): string {
  return step.kind === 'reps' ? `${step.sets} × ${step.reps}` : `${step.seconds} s`;
}

/** Where the demo figure is in its loop: reps follow their beat, timed moves their own cycle. */
function demoPhase(step: Step, now: number): number {
  const period = step.kind === 'reps' ? (step.beat.down + step.beat.up) * 1000 : step.cycle * 1000;
  if (period <= 0) return 0;
  return (1 - Math.cos(((now % period) / period) * Math.PI * 2)) / 2;
}

/**
 * Swap any move in today's session for a gentler or different one. OK on a move cycles through
 * its options; the panel acts out the focused move. Swaps are kept for next time too.
 */
export function SwapScreen({ base, swaps: initial, onDone }: { base: Session; swaps: Swaps; onDone: (swaps: Swaps) => void }) {
  const s = useScale();
  const [swaps, setSwaps] = useState<Swaps>(initial);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [panel, setPanel] = useState({ width: 0, height: 0 });

  const choiceFor = (original: Step): Step => SWAP_OPTIONS[original.id]?.find((o) => o.id === swaps[original.id]) ?? original;
  const cycle = (original: Step) => {
    const options = SWAP_OPTIONS[original.id] ?? [original];
    const next = options[(options.findIndex((o) => o.id === choiceFor(original).id) + 1) % options.length]!;
    setSwaps((current) => {
      const updated = { ...current };
      if (next.id === original.id) delete updated[original.id];
      else updated[original.id] = next.id;
      return updated;
    });
  };

  const focused = base.steps[focusedIndex]!;
  const shown = choiceFor(focused);
  const options = SWAP_OPTIONS[focused.id] ?? [focused];
  const optionIndex = options.findIndex((o) => o.id === shown.id);
  const position = useCallback(() => demoPhase(shown, Date.now()), [shown]);
  const freeLoop = useCallback(() => null, []);
  const clip = TRAINER_CLIPS[shown.id];
  const swapCount = Object.keys(swaps).length;

  const sessionName = `${base.title}${base.titleItalic}`.replace(/\s*\n\s*/g, ' ').replace(/\.$/, '').toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: s(36), paddingHorizontal: s(64), paddingBottom: s(32), gap: s(18) }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View style={{ gap: s(12) }}>
          <Kicker color={colors.accent}>
            {sessionName}
            {swapCount > 0 ? ` · ${swapCount} SWAPPED` : ''}
          </Kicker>
          <Headline text="Swap what doesn't suit you" size={56} />
        </View>
        {/* Kept away from Done so pressing down from the list can't land on it by accident. */}
        {swapCount > 0 ? <FocusButton label="Put everything back" onPress={() => setSwaps({})} variant="secondary" size="compact" /> : null}
      </View>

      <View style={{ flex: 1, flexDirection: 'row', gap: s(28) }}>
        <View style={{ width: s(560), gap: s(6) }}>
          {base.steps.map((original, i) => {
            const choice = choiceFor(original);
            const count = (SWAP_OPTIONS[original.id] ?? [original]).length;
            const swapped = choice.id !== original.id;
            return (
              <Pressable
                key={original.id}
                accessibilityRole="button"
                accessibilityLabel={`${choice.name}. Press OK to swap.`}
                hasTVPreferredFocus={i === 0}
                onFocus={() => setFocusedIndex(i)}
                onPress={() => cycle(original)}
              >
                {(state) => {
                  const focused = isFocused(state);
                  return (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: s(16),
                        paddingVertical: s(5),
                        paddingHorizontal: s(18),
                        borderRadius: s(12),
                        borderWidth: s(3),
                        borderColor: focused ? colors.text : 'transparent',
                        backgroundColor: focused ? colors.surfaceHigh : colors.surface,
                      }}
                    >
                      <Text style={{ fontFamily: fonts.sansBold, fontSize: s(13), color: colors.faint, width: s(22) }}>{String(i + 1).padStart(2, '0')}</Text>
                      <View style={{ flex: 1, gap: s(1) }}>
                        <Text style={{ fontFamily: fonts.displaySemi, fontSize: s(22), color: colors.text }}>{choice.name}</Text>
                        <Text style={{ fontFamily: fonts.sans, fontSize: s(14), color: colors.faint }}>
                          {swapped ? `instead of ${original.name.toLowerCase()}` : 'as planned'} · {amount(choice)}
                        </Text>
                      </View>
                      {swapped ? (
                        <Kicker size={12} color={colors.accent}>
                          SWAPPED
                        </Kicker>
                      ) : null}
                      <Text style={{ fontFamily: fonts.sansBold, fontSize: s(12), letterSpacing: s(1.5), color: colors.faint, width: s(56), textAlign: 'right' }}>
                        {count > 1 ? `${(SWAP_OPTIONS[original.id] ?? []).findIndex((o) => o.id === choice.id) + 1} OF ${count}` : ''}
                      </Text>
                    </View>
                  );
                }}
              </Pressable>
            );
          })}
          <View style={{ flexDirection: 'row', marginTop: 'auto', marginLeft: -s(6) }}>
            <FocusButton label="Done" onPress={() => onDone(swaps)} variant="light" />
          </View>
        </View>

        <View style={{ flex: 1, gap: s(12) }}>
          <View
            style={{ flex: 1, backgroundColor: colors.surface, borderRadius: s(20), overflow: 'hidden' }}
            onLayout={(e) => setPanel({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
          >
            {clip !== undefined ? (
              <TrainerVideo key={shown.id} clip={clip} paused={false} position={freeLoop} />
            ) : (
              <DemoFigure
                key={shown.id}
                demo={shown.demo}
                position={position}
                width={panel.width}
                height={panel.height}
                animate={shown.kind === 'reps' || shown.cycle > 0}
              />
            )}
            <View style={{ position: 'absolute', top: s(14), left: s(16), right: s(16), flexDirection: 'row', justifyContent: 'space-between' }}>
              <PanelTag>LIKE THIS · {shown.name.toUpperCase()}</PanelTag>
              <PanelTag color={colors.faint}>{options.length > 1 ? `OPTION ${optionIndex + 1} OF ${options.length}` : 'NO SWAPS FOR THIS ONE'}</PanelTag>
            </View>
          </View>
          <Note size={17}>{shown.why}</Note>
          <Kicker size={13}>{options.length > 1 ? 'PRESS OK TO TRY THE NEXT OPTION' : ' '}</Kicker>
        </View>
      </View>
    </View>
  );
}

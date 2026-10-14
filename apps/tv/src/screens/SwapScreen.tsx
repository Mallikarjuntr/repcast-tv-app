import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { FocusButton } from '../components/FocusButton';
import { PoseFigure } from '../components/PoseFigure';
import { Headline, Kicker } from '../components/Type';
import { colors, fonts, useScale } from '../theme';
import { isFocused } from '../tv';
import { blend, SWAP_OPTIONS, type Session, type Step, type Swaps } from '../workouts';

const NO_NOTES = { depth: false, knees: false, chest: false };

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
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 80);
    return () => clearInterval(timer);
  }, []);

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
  const frame = { p: blend(shown.demo.a, shown.demo.b, demoPhase(shown, now)), aspect: shown.demo.aspect, mirrored: false };
  const swapCount = Object.keys(swaps).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper, paddingTop: s(40), paddingHorizontal: s(64), paddingBottom: s(32), gap: s(18) }}>
      <View style={{ gap: s(10) }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: s(36) }}>
          <Kicker>SWAP A MOVE · {base.title.replace('\n', ' ').trim().toUpperCase()} {base.titleItalic.toUpperCase()}</Kicker>
          {/* Kept away from Done so pressing down from the list can't land on it by accident. */}
          {swapCount > 0 ? <FocusButton label="Put everything back" onPress={() => setSwaps({})} variant="link" fontSize={18} /> : null}
        </View>
        <Headline lead="Swap what " italic="doesn't suit you." size={54} />
      </View>

      <View style={{ flex: 1, flexDirection: 'row', gap: s(48) }}>
        <View style={{ flex: 1.25 }}>
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
                style={(state) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: s(16),
                  paddingVertical: s(9),
                  paddingHorizontal: s(14),
                  backgroundColor: isFocused(state) ? colors.highlighter : 'transparent',
                  borderBottomWidth: s(1.5),
                  borderBottomColor: colors.faint,
                })}
              >
                <Text style={{ fontFamily: fonts.mono, fontSize: s(16), color: colors.pencil }}>{String(i + 1).padStart(2, '0')}</Text>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: s(14) }}>
                  <Text style={{ fontFamily: fonts.display, fontSize: s(26), lineHeight: s(34), color: colors.ink }}>{choice.name}</Text>
                  {swapped ? (
                    <Text style={{ fontFamily: fonts.hand, fontSize: s(20), lineHeight: s(28), color: colors.pen }}>was {original.name.toLowerCase()}</Text>
                  ) : null}
                </View>
                <Text style={{ fontFamily: fonts.mono, fontSize: s(16), color: colors.ink }}>{amount(choice)}</Text>
                <Text style={{ fontFamily: fonts.mono, fontSize: s(13), letterSpacing: s(1.5), color: colors.pencil, width: s(64), textAlign: 'right' }}>
                  {count > 1 ? `${(SWAP_OPTIONS[original.id] ?? []).findIndex((o) => o.id === choice.id) + 1} OF ${count}` : ''}
                </Text>
              </Pressable>
            );
          })}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(28), marginTop: 'auto' }}>
            <FocusButton label="Done" onPress={() => onDone(swaps)} fontSize={22} />
          </View>
        </View>

        <View style={{ flex: 1, gap: s(12) }}>
          <View
            style={{ flex: 1, backgroundColor: colors.paperDeep, borderWidth: s(1.5), borderColor: colors.ink }}
            onLayout={(e) => setPanel({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
          >
            <View style={{ position: 'absolute', top: s(12), left: s(16), right: s(16), flexDirection: 'row', justifyContent: 'space-between' }}>
              <Kicker size={13}>LIKE THIS</Kicker>
              <Kicker size={13}>{options.length > 1 ? `OPTION ${optionIndex + 1} OF ${options.length}` : 'NO SWAPS FOR THIS ONE'}</Kicker>
            </View>
            <PoseFigure key={shown.id} frame={frame} notes={NO_NOTES} width={panel.width} height={panel.height} fitBox={shown.demo.fitBox} anchorX={0.5} />
          </View>
          <Text style={{ fontFamily: fonts.display, fontSize: s(28), lineHeight: s(36), color: colors.ink }}>{shown.name}</Text>
          <Text style={{ fontFamily: fonts.sans, fontSize: s(19), lineHeight: s(27), color: colors.inkSoft }}>{shown.why}</Text>
          <Kicker size={13}>{options.length > 1 ? 'PRESS OK TO TRY THE NEXT OPTION' : ' '}</Kicker>
        </View>
      </View>
    </View>
  );
}

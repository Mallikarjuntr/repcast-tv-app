import { memo, useEffect, useState } from 'react';
import { View } from 'react-native';
import { colors, useScale } from '../theme';
import { blend, type Demo } from '../workouts';
import { PoseFigure } from './PoseFigure';

const NO_NOTES = { depth: false, knees: false, chest: false };

/**
 * A demo figure that animates on its own frame loop, so only this panel redraws each frame and the
 * rest of the screen stays still. `position` is read every frame: 0 is keyframe A, 1 is keyframe B.
 * Pass a stable function (useCallback) so the panel isn't rebuilt by its parent's renders.
 */
export const DemoFigure = memo(function DemoFigure({
  demo,
  position,
  width,
  height,
  animate = true,
  depthBar = false,
}: {
  demo: Demo;
  position: () => number;
  width: number;
  height: number;
  /** False for a held pose (a plank): draw once, no frame loop. */
  animate?: boolean;
  /** Show how far into the rep the beat is, as an accent bar along the bottom. */
  depthBar?: boolean;
}) {
  const s = useScale();
  useFrameLoop(animate);

  const t = position();
  return (
    <>
      <PoseFigure frame={{ p: blend(demo.a, demo.b, t), aspect: demo.aspect, mirrored: false }} notes={NO_NOTES} width={width} height={height} fitBox={demo.fitBox} anchorX={0.5} />
      {depthBar ? <BarFill fraction={t} inset={s(18)} bottom={s(14)} height={s(8)} /> : null}
    </>
  );
});

/** Re-render the calling component about 30 times a second while `active`. */
function useFrameLoop(active: boolean): void {
  const [, setFrame] = useState(0);
  useEffect(() => {
    if (!active) return;
    // About 30 frames a second: smooth to the eye, and half the work of 60 on a Fire TV Stick.
    const frameMs = 1000 / 30;
    let raf = 0;
    let last = 0;
    const loop = (time: number) => {
      if (time - last >= frameMs - 2) {
        last = time;
        setFrame((f) => (f + 1) % 1_000_000);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);
}

function BarFill({ fraction, inset, bottom, height }: { fraction: number; inset: number; bottom: number; height: number }) {
  return (
    <View style={{ position: 'absolute', left: inset, right: inset, bottom, height, backgroundColor: colors.line }}>
      <View style={{ width: `${Math.round(fraction * 100)}%`, height: '100%', backgroundColor: colors.accent }} />
    </View>
  );
}

/** The accent bar along the bottom of the panel showing how far into the rep the beat is. */
export const BeatBar = memo(function BeatBar({ position, animate = true }: { position: () => number; animate?: boolean }) {
  const s = useScale();
  useFrameLoop(animate);
  return <BarFill fraction={position()} inset={s(18)} bottom={s(14)} height={s(8)} />;
});

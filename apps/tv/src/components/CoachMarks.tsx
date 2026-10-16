import type { PosePoint } from '@spotter/shared';
import Svg, { Ellipse, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { colors, fonts } from '../theme';

/** Notes the coach draws over the outline after a rep with a fault. */
export interface Annotations {
  depth: boolean;
  knees: boolean;
  chest: boolean;
}

export type Pt = { x: number; y: number } | null;

export function mid(a: Pt, b: Pt): Pt {
  if (a && b) return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  return a ?? b;
}

/**
 * The coach's marks (hips-down line, knees-out arrows, chest-up curve) at body points
 * already placed in the panel. SVG is fine here: the marks only appear for a few seconds after a rep.
 */
export function CoachMarks({
  pts,
  notes,
  width,
  height,
  headR,
  shoulderWidth,
}: {
  pts: Record<PosePoint, Pt>;
  notes: Annotations;
  width: number;
  height: number;
  headR: number;
  shoulderWidth: number;
}) {
  if (!notes.depth && !notes.knees && !notes.chest) return null;
  const noteSize = Math.max(18, width * 0.05);
  const marginX = width * 0.06;
  const shoulders = mid(pts.lShoulder, pts.rShoulder);
  const hips = mid(pts.lHip, pts.rHip);
  const knees = mid(pts.lKnee, pts.rKnee);

  return (
    <Svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }}>
      {notes.depth && knees ? (
        <G>
          <Line x1={width * 0.06} y1={knees.y} x2={width * 0.94} y2={knees.y} stroke={colors.coach} strokeWidth={2.5} strokeDasharray="10 8" />
          <SvgText x={marginX} y={knees.y - noteSize * 1.6} fontFamily={fonts.sansBold} fontSize={noteSize} fill={colors.coach}>
            hips down
          </SvgText>
          <SvgText x={marginX} y={knees.y - noteSize * 0.45} fontFamily={fonts.sansBold} fontSize={noteSize} fill={colors.coach}>
            to here
          </SvgText>
        </G>
      ) : null}

      {notes.depth && hips ? <Ellipse cx={hips.x} cy={hips.y} rx={shoulderWidth * 0.9 + 20} ry={headR * 1.3} stroke={colors.coach} strokeWidth={3} fill="none" /> : null}

      {notes.knees && pts.lKnee && pts.rKnee ? (
        <G stroke={colors.coach} strokeWidth={3} strokeLinecap="round" fill="none">
          {[pts.lKnee, pts.rKnee].map((k, i) => {
            const dir = k.x < (knees?.x ?? k.x) ? -1 : 1;
            return <Path key={i} d={`M${k.x + dir * 8} ${k.y} l${dir * 34} 0 m${-dir * 10} -8 l${dir * 10} 8 l${-dir * 10} 8`} />;
          })}
          <SvgText x={marginX} y={(knees?.y ?? 0) + noteSize * 0.35} fontFamily={fonts.sansBold} fontSize={noteSize} fill={colors.coach} stroke="none">
            knees out
          </SvgText>
        </G>
      ) : null}

      {notes.chest && shoulders ? (
        <G>
          <Path d={`M${shoulders.x + 40} ${shoulders.y + 30} C ${shoulders.x + 70} ${shoulders.y}, ${shoulders.x + 60} ${shoulders.y - 40}, ${shoulders.x + 30} ${shoulders.y - 60}`} stroke={colors.coach} strokeWidth={3} strokeLinecap="round" fill="none" />
          <SvgText x={shoulders.x + 54} y={shoulders.y - 36} fontFamily={fonts.sansBold} fontSize={noteSize} fill={colors.coach}>
            chest up
          </SvgText>
        </G>
      ) : null}
    </Svg>
  );
}

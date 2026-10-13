import { POSE_POINTS, type PosePoint } from '@spotter/shared';
import { memo, useRef } from 'react';
import Svg, { Circle, Ellipse, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { colors, fonts } from '../theme';

export interface PoseFrame {
  p: number[];
  aspect: number;
  mirrored: boolean;
}

/** Red-pen notes the coach draws over the outline after a rep with a fault. */
export interface Annotations {
  depth: boolean;
  knees: boolean;
  chest: boolean;
}

const BONES: [PosePoint, PosePoint][] = [
  ['lShoulder', 'rShoulder'],
  ['lShoulder', 'lElbow'],
  ['lElbow', 'lWrist'],
  ['rShoulder', 'rElbow'],
  ['rElbow', 'rWrist'],
  ['lShoulder', 'lHip'],
  ['rShoulder', 'rHip'],
  ['lHip', 'rHip'],
  ['lHip', 'lKnee'],
  ['lKnee', 'lAnkle'],
  ['rHip', 'rKnee'],
  ['rKnee', 'rAnkle'],
];

type Pt = { x: number; y: number } | null;

function mid(a: Pt, b: Pt): Pt {
  if (a && b) return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  return a ?? b;
}

/** The live outline of the person, fitted into the panel, with the coach's red-pen marks. */
export const PoseFigure = memo(function PoseFigure({ frame, notes, width, height }: { frame: PoseFrame | null; notes: Annotations; width: number; height: number }) {
  // Stable framing: size from the tallest recent body height (standing), feet anchored near the
  // bottom, body on the right so the coach can write notes in the left margin. A squat then
  // visibly lowers the figure instead of the figure rescaling to fill the panel.
  const tallest = useRef(0);
  const centerX = useRef<number | null>(null);
  if (!frame) return null;

  const raw = POSE_POINTS.map((_, i) => {
    const x = frame.p[i * 2]!;
    const y = frame.p[i * 2 + 1]!;
    return x < 0 || y < 0 ? null : { x: (frame.mirrored ? 1 - x : x) * frame.aspect, y };
  });
  const seen = raw.filter((q): q is { x: number; y: number } => q !== null);
  if (seen.length < 4) return null;
  const top = Math.min(...seen.map((q) => q.y));
  const bottom = Math.max(...seen.map((q) => q.y));
  tallest.current = Math.max(bottom - top, tallest.current * 0.995);
  const hipsRaw = raw[7] && raw[8] ? (raw[7].x + raw[8].x) / 2 : seen.reduce((a, q) => a + q.x, 0) / seen.length;
  centerX.current = centerX.current === null ? hipsRaw : centerX.current + 0.2 * (hipsRaw - centerX.current);
  const k = (height * 0.74) / Math.max(tallest.current, 0.05);
  const ox = width * 0.64 - centerX.current * k;
  const oy = height * 0.92 - bottom * k;
  const pts = Object.fromEntries(POSE_POINTS.map((name, i) => [name, raw[i] ? { x: ox + raw[i].x * k, y: oy + raw[i].y * k } : null])) as Record<PosePoint, Pt>;
  const noteSize = Math.max(18, width * 0.05);
  const marginX = width * 0.06;

  const shoulders = mid(pts.lShoulder, pts.rShoulder);
  const hips = mid(pts.lHip, pts.rHip);
  const knees = mid(pts.lKnee, pts.rKnee);
  const shoulderWidth = pts.lShoulder && pts.rShoulder ? Math.abs(pts.lShoulder.x - pts.rShoulder.x) : k * 0.08;
  const headR = Math.max(10, shoulderWidth * 0.32);
  const stroke = Math.max(5, width * 0.018);

  return (
    <Svg width={width} height={height}>
      {notes.depth && knees ? (
        <G>
          <Line x1={width * 0.06} y1={knees.y} x2={width * 0.94} y2={knees.y} stroke={colors.pen} strokeWidth={2.5} strokeDasharray="10 8" />
          <SvgText x={marginX} y={knees.y - noteSize * 1.6} fontFamily={fonts.hand} fontSize={noteSize} fill={colors.pen}>
            hips down
          </SvgText>
          <SvgText x={marginX} y={knees.y - noteSize * 0.45} fontFamily={fonts.hand} fontSize={noteSize} fill={colors.pen}>
            to here
          </SvgText>
        </G>
      ) : null}

      <G stroke={colors.ink} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" fill="none">
        {BONES.map(([a, b]) => {
          const pa = pts[a];
          const pb = pts[b];
          return pa && pb ? <Line key={`${a}-${b}`} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} /> : null;
        })}
        {pts.nose ? <Circle cx={pts.nose.x} cy={pts.nose.y} r={headR} strokeWidth={stroke * 0.8} /> : null}
      </G>

      {notes.depth && hips ? <Ellipse cx={hips.x} cy={hips.y} rx={shoulderWidth * 0.9 + 20} ry={headR * 1.3} stroke={colors.pen} strokeWidth={3} fill="none" /> : null}

      {notes.knees && pts.lKnee && pts.rKnee ? (
        <G stroke={colors.pen} strokeWidth={3} strokeLinecap="round" fill="none">
          {[pts.lKnee, pts.rKnee].map((k, i) => {
            const dir = k.x < (knees?.x ?? k.x) ? -1 : 1;
            return <Path key={i} d={`M${k.x + dir * 8} ${k.y} l${dir * 34} 0 m${-dir * 10} -8 l${dir * 10} 8 l${-dir * 10} 8`} />;
          })}
          <SvgText x={marginX} y={(knees?.y ?? 0) + noteSize * 0.35} fontFamily={fonts.hand} fontSize={noteSize} fill={colors.pen} stroke="none">
            knees out
          </SvgText>
        </G>
      ) : null}

      {notes.chest && shoulders ? (
        <G>
          <Path d={`M${shoulders.x + 40} ${shoulders.y + 30} C ${shoulders.x + 70} ${shoulders.y}, ${shoulders.x + 60} ${shoulders.y - 40}, ${shoulders.x + 30} ${shoulders.y - 60}`} stroke={colors.pen} strokeWidth={3} strokeLinecap="round" fill="none" />
          <SvgText x={shoulders.x + 54} y={shoulders.y - 36} fontFamily={fonts.hand} fontSize={noteSize} fill={colors.pen}>
            chest up
          </SvgText>
        </G>
      ) : null}
    </Svg>
  );
});

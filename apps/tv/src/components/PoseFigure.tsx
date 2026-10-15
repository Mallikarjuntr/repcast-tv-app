import { POSE_POINTS, type PosePoint } from '@spotter/shared';
import { memo, useRef } from 'react';
import { View } from 'react-native';
import { colors } from '../theme';
import { CoachMarks, type Annotations, type Pt } from './CoachMarks';

export type { Annotations } from './CoachMarks';

export interface PoseFrame {
  p: number[];
  aspect: number;
  mirrored: boolean;
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

/** The live outline of the person, fitted into the panel, with the coach's red-pen marks. */
export const PoseFigure = memo(function PoseFigure({
  frame,
  notes,
  width,
  height,
  fitBox = false,
  anchorX = 0.64,
}: {
  frame: PoseFrame | null;
  notes: Annotations;
  width: number;
  height: number;
  fitBox?: boolean;
  /** Where the hips sit across the panel (0..1); off-centre leaves a margin for notes. */
  anchorX?: number;
}) {
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
  let k = (height * 0.74) / Math.max(tallest.current, 0.05);
  let ox = width * anchorX - centerX.current * k;
  let oy = height * 0.92 - bottom * k;
  if (fitBox) {
    // Lying or wide poses: fit the whole body in the panel, centred.
    const left = Math.min(...seen.map((q) => q.x));
    const right = Math.max(...seen.map((q) => q.x));
    k = Math.min((width * 0.8) / Math.max(right - left, 0.05), (height * 0.6) / Math.max(bottom - top, 0.05));
    ox = width / 2 - ((left + right) / 2) * k;
    oy = height * 0.6 - ((top + bottom) / 2) * k;
  }
  const pts = Object.fromEntries(POSE_POINTS.map((name, i) => [name, raw[i] ? { x: ox + raw[i].x * k, y: oy + raw[i].y * k } : null])) as Record<PosePoint, Pt>;
  const shoulderWidth = pts.lShoulder && pts.rShoulder ? Math.abs(pts.lShoulder.x - pts.rShoulder.x) : k * 0.08;
  // Side-on, the shoulders overlap: fall back to a head sized from the body scale.
  const headR = Math.max(10, shoulderWidth * 0.32, k * 0.035);
  const stroke = Math.max(5, width * 0.018);

  return (
    <View style={{ width, height }}>
      {/* The body is plain native views, not SVG: on Android an SVG is repainted into a bitmap and
          re-uploaded to the GPU every frame, which a Fire TV Stick can't keep up with. */}
      {BONES.map(([a, b]) => {
        const pa = pts[a];
        const pb = pts[b];
        if (!pa || !pb) return null;
        const length = Math.hypot(pb.x - pa.x, pb.y - pa.y) + stroke;
        return (
          <View
            key={`${a}-${b}`}
            style={{
              position: 'absolute',
              left: (pa.x + pb.x) / 2 - length / 2,
              top: (pa.y + pb.y) / 2 - stroke / 2,
              width: length,
              height: stroke,
              borderRadius: stroke / 2,
              backgroundColor: colors.ink,
              transform: [{ rotate: `${Math.atan2(pb.y - pa.y, pb.x - pa.x)}rad` }],
            }}
          />
        );
      })}
      {pts.nose ? (
        <View
          style={{
            position: 'absolute',
            left: pts.nose.x - headR,
            top: pts.nose.y - headR,
            width: headR * 2,
            height: headR * 2,
            borderRadius: headR,
            borderWidth: stroke * 0.8,
            borderColor: colors.ink,
          }}
        />
      ) : null}
      <CoachMarks pts={pts} notes={notes} width={width} height={height} headR={headR} shoulderWidth={shoulderWidth} />
    </View>
  );
});

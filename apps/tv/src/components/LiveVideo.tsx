import { POSE_POINTS, type PosePoint } from '@spotter/shared';
import { memo, useEffect, useState } from 'react';
import { View } from 'react-native';
import { RTCView } from 'react-native-webrtc';
import { colors } from '../theme';
import { CoachMarks, type Annotations, type Pt } from './CoachMarks';
import type { PoseFrame } from './PoseFigure';

/** An outline older than this no longer matches the picture, so it is hidden. */
const STALE_MS = 1000;

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

/** Where a video of this aspect sits inside the panel with objectFit "contain". */
export function fitContain(width: number, height: number, aspect: number): { left: number; top: number; w: number; h: number } {
  if (aspect > width / height) {
    const h = width / aspect;
    return { left: 0, top: (height - h) / 2, w: width, h };
  }
  const w = height * aspect;
  return { left: (width - w) / 2, top: 0, w, h: height };
}

/**
 * Body points placed on the displayed video. The phone's points are relative to its camera frame
 * (before any mirroring), the same frame it sends as video, so they map straight onto the picture.
 */
export function placeOnVideo(frame: PoseFrame, width: number, height: number): Record<PosePoint, Pt> {
  const box = fitContain(width, height, frame.aspect);
  return Object.fromEntries(
    POSE_POINTS.map((name, i) => {
      const x = frame.p[i * 2]!;
      const y = frame.p[i * 2 + 1]!;
      if (x < 0 || y < 0) return [name, null];
      return [name, { x: box.left + (frame.mirrored ? 1 - x : x) * box.w, y: box.top + y * box.h }];
    }),
  ) as Record<PosePoint, Pt>;
}

/** Highlighter bones with an ink edge, so they read on any picture. */
function Bone({ a, b, stroke }: { a: { x: number; y: number }; b: { x: number; y: number }; stroke: number }) {
  const length = Math.hypot(b.x - a.x, b.y - a.y) + stroke;
  return (
    <View
      style={{
        position: 'absolute',
        left: (a.x + b.x) / 2 - length / 2,
        top: (a.y + b.y) / 2 - stroke / 2,
        width: length,
        height: stroke,
        borderRadius: stroke / 2,
        backgroundColor: colors.highlighter,
        borderWidth: Math.max(1, stroke * 0.18),
        borderColor: colors.ink,
        transform: [{ rotate: `${Math.atan2(b.y - a.y, b.x - a.x)}rad` }],
      }}
    />
  );
}

/**
 * The skeleton over the video. It subscribes to outlines itself and redraws on each one, so the
 * screen around it doesn't re-render ~12 times a second. Drawn with native views, not SVG (the
 * Fire TV Stick can't afford re-uploading an SVG bitmap every frame).
 */
const Skeleton = memo(function Skeleton({
  getPose,
  subscribePose,
  notes,
  width,
  height,
  onMirrored,
}: {
  getPose: () => { frame: PoseFrame; at: number } | null;
  subscribePose: (listener: () => void) => () => void;
  notes: Annotations;
  width: number;
  height: number;
  onMirrored: (mirrored: boolean) => void;
}) {
  const [, setTick] = useState(0);
  useEffect(() => subscribePose(() => setTick((t) => (t + 1) % 1_000_000)), [subscribePose]);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => (t + 1) % 1_000_000), 500);
    return () => clearInterval(timer);
  }, []);

  const latest = getPose();
  useEffect(() => {
    if (latest) onMirrored(latest.frame.mirrored);
  }, [latest?.frame.mirrored, onMirrored]);
  if (!latest || Date.now() - latest.at > STALE_MS || width === 0) return null;

  const pts = placeOnVideo(latest.frame, width, height);
  const box = fitContain(width, height, latest.frame.aspect);
  const stroke = Math.max(4, box.h * 0.014);
  const shoulderWidth = pts.lShoulder && pts.rShoulder ? Math.abs(pts.lShoulder.x - pts.rShoulder.x) : box.w * 0.08;
  const headR = Math.max(8, shoulderWidth * 0.32);
  return (
    <View style={{ position: 'absolute', left: 0, top: 0, width, height }} pointerEvents="none">
      {BONES.map(([a, b]) => {
        const pa = pts[a];
        const pb = pts[b];
        return pa && pb ? <Bone key={`${a}-${b}`} a={pa} b={pb} stroke={stroke} /> : null;
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
            borderWidth: stroke * 0.7,
            borderColor: colors.highlighter,
          }}
        />
      ) : null}
      <CoachMarks pts={pts} notes={notes} width={width} height={height} headR={headR} shoulderWidth={shoulderWidth} />
    </View>
  );
});

/**
 * The phone's live camera with the user's skeleton drawn on top, both mirrored together for a
 * front camera so it reads like a mirror.
 */
export function LiveVideo({
  streamUrl,
  getPose,
  subscribePose,
  notes,
  width,
  height,
}: {
  streamUrl: string;
  getPose: () => { frame: PoseFrame; at: number } | null;
  subscribePose: (listener: () => void) => () => void;
  notes: Annotations;
  width: number;
  height: number;
}) {
  const [mirrored, setMirrored] = useState(getPose()?.frame.mirrored ?? false);
  return (
    <View style={{ position: 'absolute', left: 0, top: 0, width, height, backgroundColor: colors.ink }}>
      <RTCView streamURL={streamUrl} objectFit="contain" mirror={mirrored} style={{ width, height }} />
      <Skeleton getPose={getPose} subscribePose={subscribePose} notes={notes} width={width} height={height} onMirrored={setMirrored} />
    </View>
  );
}

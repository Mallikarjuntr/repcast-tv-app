import { POSE_POINTS, type PosePoint } from '@spotter/shared';
import { memo, useEffect, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
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

/** Bones are drawn this long and stretched with scaleX, so a new pose only changes transforms. */
const BONE_BASE = 400;
const HEAD_BASE = 40;

interface Part {
  x: Animated.Value;
  y: Animated.Value;
  angle: Animated.Value;
  scale: Animated.Value;
  opacity: Animated.Value;
  rotate: Animated.AnimatedInterpolation<string>;
}

function makePart(): Part {
  const angle = new Animated.Value(0);
  return {
    x: new Animated.Value(0),
    y: new Animated.Value(0),
    angle,
    scale: new Animated.Value(0),
    opacity: new Animated.Value(0),
    rotate: angle.interpolate({ inputRange: [-10, 10], outputRange: ['-10rad', '10rad'] }),
  };
}

/**
 * The skeleton over the video. Each pose (about 20 a second) only sets animated values that the
 * native side applies directly, so nothing re-renders in React per frame: on a Fire TV Stick a
 * React redraw per pose kept the app at ~100% CPU. Native views, not SVG (the stick can't afford
 * re-uploading an SVG bitmap every frame). The coach's marks re-render, but only while showing.
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
  const bones = useRef(BONES.map(makePart)).current;
  const head = useRef(makePart()).current;
  const [aspect, setAspect] = useState<number | null>(() => getPose()?.frame.aspect ?? null);
  const [, setTick] = useState(0);
  const anyNote = notes.depth || notes.knees || notes.chest;
  const marks = useRef(anyNote);
  marks.current = anyNote;
  const box = aspect ? fitContain(width, height, aspect) : null;
  const stroke = box ? Math.max(4, box.h * 0.014) : 4;

  useEffect(() => {
    // One native-driven step makes every value native; from then on setValue goes straight to the UI side.
    const all = [...bones, head].flatMap((part) => [part.x, part.y, part.angle, part.scale, part.opacity]);
    Animated.parallel(all.map((value) => Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: true }))).start();
  }, [bones, head]);

  useEffect(() => {
    const hide = () => {
      bones.forEach((part) => part.opacity.setValue(0));
      head.opacity.setValue(0);
    };
    const draw = () => {
      const latest = getPose();
      if (!latest || Date.now() - latest.at > STALE_MS || width === 0) return hide();
      const { frame } = latest;
      setAspect(frame.aspect);
      onMirrored(frame.mirrored);
      const pts = placeOnVideo(frame, width, height);
      const lineWidth = Math.max(4, fitContain(width, height, frame.aspect).h * 0.014);
      BONES.forEach(([from, to], i) => {
        const part = bones[i]!;
        const pa = pts[from];
        const pb = pts[to];
        if (!pa || !pb) return part.opacity.setValue(0);
        part.x.setValue((pa.x + pb.x) / 2 - BONE_BASE / 2);
        part.y.setValue((pa.y + pb.y) / 2 - lineWidth / 2);
        part.angle.setValue(Math.atan2(pb.y - pa.y, pb.x - pa.x));
        part.scale.setValue((Math.hypot(pb.x - pa.x, pb.y - pa.y) + lineWidth) / BONE_BASE);
        part.opacity.setValue(1);
      });
      if (pts.nose) {
        const shoulderWidth = pts.lShoulder && pts.rShoulder ? Math.abs(pts.lShoulder.x - pts.rShoulder.x) : width * 0.08;
        const headR = Math.max(8, shoulderWidth * 0.32);
        head.x.setValue(pts.nose.x - HEAD_BASE / 2);
        head.y.setValue(pts.nose.y - HEAD_BASE / 2);
        head.scale.setValue((headR * 2) / HEAD_BASE);
        head.opacity.setValue(1);
      } else {
        head.opacity.setValue(0);
      }
      if (marks.current) setTick((t) => (t + 1) % 1_000_000);
    };
    draw();
    const unsubscribe = subscribePose(draw);
    const timer = setInterval(draw, 500);
    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, [getPose, subscribePose, width, height, onMirrored, bones, head]);

  const latest = anyNote ? getPose() : null;
  const pts = latest && Date.now() - latest.at <= STALE_MS ? placeOnVideo(latest.frame, width, height) : null;
  const shoulderWidth = pts?.lShoulder && pts.rShoulder ? Math.abs(pts.lShoulder.x - pts.rShoulder.x) : width * 0.08;
  return (
    <View style={{ position: 'absolute', left: 0, top: 0, width, height }} pointerEvents="none">
      {bones.map((part, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: BONE_BASE,
            height: stroke,
            borderRadius: stroke / 2,
            backgroundColor: colors.accent,
            borderWidth: Math.max(1, stroke * 0.18),
            borderColor: colors.bg,
            opacity: part.opacity,
            transform: [{ translateX: part.x }, { translateY: part.y }, { rotate: part.rotate }, { scaleX: part.scale }],
          }}
        />
      ))}
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: HEAD_BASE,
          height: HEAD_BASE,
          borderRadius: HEAD_BASE / 2,
          borderWidth: Math.max(2, stroke * 0.5),
          borderColor: colors.accent,
          opacity: head.opacity,
          transform: [{ translateX: head.x }, { translateY: head.y }, { scale: head.scale }],
        }}
      />
      {pts ? <CoachMarks pts={pts} notes={notes} width={width} height={height} headR={Math.max(8, shoulderWidth * 0.32)} shoulderWidth={shoulderWidth} /> : null}
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
    <View style={{ position: 'absolute', left: 0, top: 0, width, height, backgroundColor: colors.bg }}>
      <RTCView streamURL={streamUrl} objectFit="contain" mirror={mirrored} style={{ width, height }} />
      <Skeleton getPose={getPose} subscribePose={subscribePose} notes={notes} width={width} height={height} onMirrored={setMirrored} />
    </View>
  );
}

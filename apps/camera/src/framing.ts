import type { FramingHint } from '@spotter/shared';
import { POINTS, type PointName } from 'spotter-movement';

/** A pose landmark, normalised to the camera frame (as MediaPipe gives it, never mirrored). */
export interface Point {
  x: number;
  y: number;
  visibility?: number;
}

const MIN_VISIBILITY = 0.5;
/** Hips this close to a side edge: ask the person to move towards the middle. */
const EDGE = 0.2;
/**
 * A torso shorter than this (fraction of the frame height) is too far away to judge well: the whole
 * body then fills under about 40% of the picture.
 */
const MIN_TORSO = 0.12;

/** Confident and inside the picture: the pose model also guesses points beyond the edges. */
export function inView(p: Point | undefined): boolean {
  return p !== undefined && (p.visibility ?? 0) >= MIN_VISIBILITY && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
}

const seen = (pose: Point[], name: PointName) => inView(pose[POINTS[name]]);

function mean(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

/**
 * Whether everything this exercise needs is in view, and what to say if not. Only the exercise's own
 * points gate `ready` (a squat needs hips and knees), so a set can start with the feet cut off; but
 * standing moves still ask to step back until the feet show, as the feet tell a squat from a lunge
 * and a person moving from a phone moving.
 *
 * Directions are the person's own: they face the phone, so someone on the left of the camera image
 * is standing to their own right and should move to their left.
 */
export function framing(pose: Point[] | undefined, required: readonly PointName[], sideOn: boolean, wantFeet = false): { ready: boolean; hint?: FramingHint } {
  const visible = pose ? (Object.keys(POINTS) as PointName[]).filter((name) => seen(pose, name)) : [];
  if (!pose || visible.length < 4) return { ready: false, hint: 'step-in' };

  const x = (name: PointName) => pose[POINTS[name]]!.x;
  const y = (name: PointName) => pose[POINTS[name]]!.y;
  const hips = (['leftHip', 'rightHip'] as const).filter((n) => seen(pose, n));
  const centre = mean((hips.length ? hips : visible).map(x))!;
  const ready = required.every((name) => seen(pose, name));

  if (centre < EDGE) return { ready, hint: 'move-left' };
  if (centre > 1 - EDGE) return { ready, hint: 'move-right' };
  // Centred but something the exercise needs is cut off: almost always standing too close.
  if (!ready) return { ready, hint: 'step-back' };

  // Torso length in the image, whichever way the body lies (standing, or side-on on the floor).
  const shoulderPts = (['leftShoulder', 'rightShoulder'] as const).filter((n) => seen(pose, n));
  const sx = mean(shoulderPts.map(x));
  const sy = mean(shoulderPts.map(y));
  const hx = mean(hips.map(x));
  const hy = mean(hips.map(y));
  if (sx !== null && sy !== null && hx !== null && hy !== null && Math.hypot(hx - sx, hy - sy) < MIN_TORSO) return { ready, hint: 'come-closer' };
  if (wantFeet && !(seen(pose, 'leftAnkle') && seen(pose, 'rightAnkle'))) return { ready, hint: 'step-back' };
  if (sideOn) return { ready, hint: 'turn-phone' };
  return { ready };
}

/**
 * Holds a new value back until it has lasted a moment, so a stumble or one rep can't flip it (the
 * knees drop out of view at the bottom of a squat; a body turns side-on for a second).
 */
export class Steady<T> {
  private candidate: T;
  private since = 0;
  private current: T;

  constructor(initial: T, private readonly holdMs = 1500) {
    this.candidate = initial;
    this.current = initial;
  }

  update(value: T, now: number): T {
    if (value !== this.candidate) {
      this.candidate = value;
      this.since = now;
    }
    if (now - this.since >= this.holdMs) this.current = value;
    return this.current;
  }
}

/** The framing hint, steadied the same way. */
export class SteadyHint extends Steady<FramingHint | undefined> {
  constructor(holdMs = 1500) {
    super(undefined, holdMs);
  }
}

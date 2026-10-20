import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

/**
 * Steadies the skeleton people see (on the phone and the TV); the rep engine keeps the raw points.
 *
 * Three fixes, measured on side-on split-squat gym clips (where the legs shook most):
 * - Side-on, MediaPipe swaps the left and right legs every few frames (22 times in 16 s with the
 *   lite model), so the drawn legs jump across each other. Each leg is kept on its own track: when
 *   the new frame fits much better with the legs crossed over, they are swapped back.
 * - Legs get a median of the last three frames first, which removes one-frame spikes (the hidden
 *   far leg flickers side-on). Big frame-to-frame jumps in the legs: 315 → 138 and 195 → 37 on the
 *   two clips, for about one frame of extra delay on the legs only.
 * - Everything then goes through a One-Euro filter: strong smoothing while a joint is still, almost
 *   none while it moves fast, so the skeleton stays on the body during a rep. Legs are smoothed a
 *   little harder than the upper body.
 */
const LEG_PAIRS: [number, number][] = [[25, 26], [27, 28], [29, 30], [31, 32]];
const LEG_POINTS = new Set(LEG_PAIRS.flat());
const SWAP_RATIO = 0.6; // swap only when crossed is clearly better than kept
const BODY = { minCutoff: 1.0, beta: 8 }; // Hz at rest; how fast the cut-off rises with speed
const LEGS = { minCutoff: 0.6, beta: 4 };
const D_CUTOFF = 1.0;

const alpha = (cutoff: number, dt: number) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));

class OneEuro {
  private x: number | null = null;
  private dx = 0;
  private readonly minCutoff: number;
  private readonly beta: number;
  constructor(minCutoff: number, beta: number) {
    this.minCutoff = minCutoff;
    this.beta = beta;
  }
  filter(value: number, dt: number): number {
    if (this.x === null || dt <= 0) { this.x = value; return value; }
    const d = (value - this.x) / dt;
    this.dx += alpha(D_CUTOFF, dt) * (d - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += alpha(cutoff, dt) * (value - this.x);
    return this.x;
  }
}

const median3 = (a: number, b: number, c: number) => Math.max(Math.min(a, b), Math.min(Math.max(a, b), c));

export class DisplayPose {
  private prev: NormalizedLandmark[] | null = null;
  private recent: NormalizedLandmark[][] = [];
  private filters: OneEuro[] = [];
  private lastT = 0;

  /** `t` in milliseconds. Returns a new array; the input is left untouched. */
  update(pose: NormalizedLandmark[] | undefined, t: number): NormalizedLandmark[] | undefined {
    if (!pose) { this.prev = null; this.recent = []; this.filters = []; return pose; }
    const p = pose.map((l) => ({ ...l }));
    if (this.prev && this.legsCrossed(p, this.prev)) {
      for (const [a, b] of LEG_PAIRS) {
        const la = p[a], lb = p[b];
        if (la && lb) { p[a] = lb; p[b] = la; }
      }
    }
    const dt = this.prev ? Math.min(0.2, (t - this.lastT) / 1000) : 0;
    this.prev = p.map((l) => ({ ...l }));
    this.lastT = t;
    this.recent.push(this.prev);
    if (this.recent.length > 3) this.recent.shift();
    const [r0, r1, r2] = this.recent;
    return p.map((l, i) => {
      let { x, y } = l;
      if (LEG_POINTS.has(i) && r0 && r1 && r2 && r0[i] && r1[i] && r2[i]) {
        x = median3(r0[i].x, r1[i].x, r2[i].x);
        y = median3(r0[i].y, r1[i].y, r2[i].y);
      }
      const k = LEG_POINTS.has(i) ? LEGS : BODY;
      const fx = (this.filters[i * 2] ??= new OneEuro(k.minCutoff, k.beta));
      const fy = (this.filters[i * 2 + 1] ??= new OneEuro(k.minCutoff, k.beta));
      return { ...l, x: fx.filter(x, dt), y: fy.filter(y, dt) };
    });
  }

  /** True when this frame's legs line up much better with the last frame's if swapped. */
  private legsCrossed(p: NormalizedLandmark[], prev: NormalizedLandmark[]): boolean {
    const dist = (a?: NormalizedLandmark, b?: NormalizedLandmark) => (a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0);
    let kept = 0, crossed = 0;
    for (const [a, b] of LEG_PAIRS.slice(0, 2)) {
      kept += dist(p[a], prev[a]) + dist(p[b], prev[b]);
      crossed += dist(p[a], prev[b]) + dist(p[b], prev[a]);
    }
    return crossed < kept * SWAP_RATIO;
  }
}

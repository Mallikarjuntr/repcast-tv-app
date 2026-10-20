import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

/**
 * Steadies the skeleton people see (on the phone and the TV); the rep engine keeps the raw points.
 *
 * Two fixes, both measured on a side-on split-squat gym clip:
 * - Side-on, MediaPipe swaps the left and right legs every few frames (22 times in 16 s with the
 *   lite model), so the drawn legs jump across each other. Each leg is kept on its own track: when
 *   the new frame fits much better with the legs crossed over, they are swapped back.
 * - The remaining jitter is smoothed with a One-Euro filter: strong smoothing while a joint is
 *   still, almost none while it moves fast, so the skeleton stays on the body during a rep.
 */
const LEG_PAIRS: [number, number][] = [[25, 26], [27, 28], [29, 30], [31, 32]];
const SWAP_RATIO = 0.6; // swap only when crossed is clearly better than kept
const MIN_CUTOFF = 1.0; // Hz at rest
const BETA = 8; // how fast the cut-off rises with speed (frame widths per second)
const D_CUTOFF = 1.0;

const alpha = (cutoff: number, dt: number) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));

class OneEuro {
  private x: number | null = null;
  private dx = 0;
  filter(value: number, dt: number): number {
    if (this.x === null || dt <= 0) { this.x = value; return value; }
    const d = (value - this.x) / dt;
    this.dx += alpha(D_CUTOFF, dt) * (d - this.dx);
    const cutoff = MIN_CUTOFF + BETA * Math.abs(this.dx);
    this.x += alpha(cutoff, dt) * (value - this.x);
    return this.x;
  }
}

export class DisplayPose {
  private prev: NormalizedLandmark[] | null = null;
  private filters: OneEuro[] = [];
  private lastT = 0;

  /** `t` in milliseconds. Returns a new array; the input is left untouched. */
  update(pose: NormalizedLandmark[] | undefined, t: number): NormalizedLandmark[] | undefined {
    if (!pose) { this.prev = null; this.filters = []; return pose; }
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
    return p.map((l, i) => {
      const fx = (this.filters[i * 2] ??= new OneEuro());
      const fy = (this.filters[i * 2 + 1] ??= new OneEuro());
      return { ...l, x: fx.filter(l.x, dt), y: fy.filter(l.y, dt) };
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

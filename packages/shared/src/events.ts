/** Body parts the TV's framing checklist asks about. */
export type BodyPart = 'head' | 'hips' | 'knees' | 'feet';

export const BODY_PARTS: readonly BodyPart[] = ['head', 'hips', 'knees', 'feet'];

/** Messages the camera device sends to the TV over the session channel. */
export type SpotterEvent =
  | { type: 'hello'; device: string; at: number }
  | { type: 'framing'; visible: Record<BodyPart, boolean>; at: number }
  | { type: 'rep'; exercise: string; count: number; depthOk: boolean | null; cues: string[]; at: number }
  | { type: 'bye'; at: number };

export function parseEvent(raw: string): SpotterEvent | null {
  try {
    const value = JSON.parse(raw) as { type?: unknown };
    return typeof value?.type === 'string' ? (value as SpotterEvent) : null;
  } catch {
    return null;
  }
}

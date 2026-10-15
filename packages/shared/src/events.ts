/** Body parts the TV's framing checklist asks about. */
export type BodyPart = 'head' | 'hips' | 'knees' | 'feet';

export const BODY_PARTS: readonly BodyPart[] = ['head', 'hips', 'knees', 'feet'];

/**
 * Points streamed for the TV's live outline, in this order (MediaPipe Pose indices in brackets):
 * nose(0), shoulders(11,12), elbows(13,14), wrists(15,16), hips(23,24), knees(25,26), ankles(27,28).
 */
export const POSE_POINTS = ['nose', 'lShoulder', 'rShoulder', 'lElbow', 'rElbow', 'lWrist', 'rWrist', 'lHip', 'rHip', 'lKnee', 'rKnee', 'lAnkle', 'rAnkle'] as const;
export const POSE_SOURCE_INDEX = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28] as const;

export type PosePoint = (typeof POSE_POINTS)[number];

/** Messages the camera device sends to the TV over the session channel. */
export type SpotterEvent =
  | { type: 'hello'; device: string; at: number }
  | {
      type: 'framing';
      visible: Record<BodyPart, boolean>;
      /** The phone sees the person side-on, so one leg hides the other. */
      sideOn?: boolean;
      at: number;
    }
  | {
      type: 'pose';
      /** x,y pairs (0..1, 3 decimals) in POSE_POINTS order; -1,-1 when a point isn't visible. */
      p: number[];
      /** Camera width / height. */
      aspect: number;
      /** True for a front (selfie) camera, so the TV can show a mirror image. */
      mirrored: boolean;
      at: number;
    }
  | {
      type: 'rep';
      exercise: string;
      /** Counted reps so far on the phone (unchanged by a no-rep). */
      count: number;
      /** False when the attempt doesn't count; `cues[0]` says why. */
      counted: boolean;
      verdict: 'good' | 'fix' | 'no-rep';
      depthOk: boolean | null;
      /** Form check ids, e.g. 'knees-caving', 'chest-dropping'. */
      faults: string[];
      /** What the coach says, most important first. */
      cues: string[];
      at: number;
    }
  | { type: 'bye'; at: number }
  | RtcSignal;

/**
 * WebRTC set-up for the live camera video, sent both ways on the session's `rtcChannel`. The
 * phone offers, the TV answers, and both trickle ICE candidates. Each side also receives its own
 * messages back on the channel, so it ignores those with its own `from`.
 */
export interface RtcSignal {
  type: 'rtc';
  from: 'phone' | 'tv';
  /**
   * Which connection attempt this belongs to. Every offer starts a new one; the answer and
   * candidates carry the offer's id, so leftovers from an older attempt are ignored.
   */
  link?: string;
  /** The TV asks for a fresh offer when it (re)joins or its connection drops. */
  want?: 'offer';
  sdp?: { type: 'offer' | 'answer'; sdp: string };
  /** A trickled ICE candidate; null marks the end of candidates. */
  candidate?: { candidate: string; sdpMid: string | null; sdpMLineIndex: number | null } | null;
  at: number;
}

/**
 * Video set-up has its own sub-channel, so the phone (which listens for the TV's answers) doesn't
 * also receive its own pose stream back, and existing listeners on the session channel see no change.
 */
export function rtcChannel(sessionChannel: string): string {
  return `${sessionChannel}/rtc`;
}

export function parseEvent(raw: string): SpotterEvent | null {
  try {
    const value = JSON.parse(raw) as { type?: unknown };
    return typeof value?.type === 'string' ? (value as SpotterEvent) : null;
  } catch {
    return null;
  }
}

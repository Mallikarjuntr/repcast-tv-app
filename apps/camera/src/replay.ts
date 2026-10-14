// Replay test bench: runs a recorded video through the same pose model and movement engine as the
// phone, frame by frame, and reports every rep verdict. Lets the engine be tested on real movement
// without someone exercising in front of a camera.
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { EXERCISES, isUpright, RepDetector, stance, torsoTilt, type RepExercise, type RepResult } from 'spotter-movement';

function shoulderRatio(p: { x: number; y: number }[], ax: number): number {
  const sw = Math.hypot((p[11]!.x - p[12]!.x) * ax, p[11]!.y - p[12]!.y);
  const torso = Math.hypot(((p[11]!.x + p[12]!.x) / 2 - (p[23]!.x + p[24]!.x) / 2) * ax, (p[11]!.y + p[12]!.y) / 2 - (p[23]!.y + p[24]!.y) / 2);
  return sw / torso;
}

const MODEL_URL = {
  lite: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
  full: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
};

const params = new URLSearchParams(location.search);
const src = params.get('src');
const exerciseId = params.get('exercise') ?? 'squat';
/** Frames analysed per second of video; the phone manages about 15–19. */
const fps = Number(params.get('fps') ?? '15');
/** Optional detailed per-frame trace window, in seconds: ?trace=17-25 */
/** Optional: stop after this many seconds of video. */
const until = Number(params.get('until') ?? 'Infinity');
const [traceFrom, traceTo] = (params.get('trace') ?? '-1--1').split('-').map(Number) as [number, number];
const model = params.get('model') === 'full' ? 'full' : 'lite';

const video = document.getElementById('video') as HTMLVideoElement;
const overlay = document.getElementById('overlay') as HTMLCanvasElement;
const countEl = document.getElementById('count')!;
const cueEl = document.getElementById('cue')!;
const logEl = document.getElementById('log')!;
const resultEl = document.getElementById('result')!;

declare global {
  interface Window {
    /** Set when the replay finishes, for automated checks. */
    spotterResult?: unknown;
  }
}

const BONES: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28],
];

async function main(): Promise<void> {
  const exercise = EXERCISES[exerciseId];
  if (!src || !exercise || exercise.type !== 'rep') {
    cueEl.textContent = 'Give ?src=<video url> and ?exercise=squat or lunge.';
    return;
  }
  const vision = await FilesetResolver.forVisionTasks(`${import.meta.env.BASE_URL}mediapipe/wasm`);
  const landmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_URL[model], delegate: 'GPU' },
    runningMode: 'VIDEO',
    numPoses: 1,
  });
  const detector = new RepDetector(exercise as RepExercise);
  const reps: RepResult[] = [];
  let frames = 0;
  let posed = 0;
  let upright = 0;
  let minMetric = Infinity;
  let maxMetric = -Infinity;
  const tilts: number[] = [];
  const timeline: string[] = [];
  const trace: string[] = [];
  /** Torso lengths seen while standing; their median normalises stance measurements. */
  const torsos: number[] = [];

  video.src = src;
  await new Promise((resolve, reject) => {
    video.onloadeddata = resolve;
    video.onerror = () => reject(new Error('Video failed to load'));
  });
  overlay.width = video.videoWidth;
  overlay.height = video.videoHeight;
  cueEl.textContent = `Replaying ${exercise.name.toLowerCase()} at ${fps} frames/s with the ${model} model…`;

  const ctx = overlay.getContext('2d')!;
  // Step through the video by seeking, at the phone's frame rate, so results don't depend on how
  // fast this machine decodes or whether the page is visible.
  const step = 1 / fps;
  for (let time = 0; time < Math.min(video.duration, until); time += step) {
    video.currentTime = time;
    await new Promise((resolve) => video.addEventListener('seeked', resolve, { once: true }));
    const t = Math.round(time * 1000);
    const result = landmarker.detectForVideo(video, t);
    frames++;
    const pose = result.landmarks[0];
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    if (!pose) continue;
    posed++;
    ctx.strokeStyle = '#f5d547';
    ctx.lineWidth = overlay.width * 0.008;
    for (const [a, b] of BONES) {
      const pa = pose[a];
      const pb = pose[b];
      if (!pa || !pb || (pa.visibility ?? 0) < 0.5 || (pb.visibility ?? 0) < 0.5) continue;
      ctx.beginPath();
      ctx.moveTo(pa.x * overlay.width, pa.y * overlay.height);
      ctx.lineTo(pb.x * overlay.width, pb.y * overlay.height);
      ctx.stroke();
    }
    const frame = { t, landmarks: pose, world: result.worldLandmarks[0], aspect: video.videoWidth / video.videoHeight };
    const update = detector.update(frame);
    if (update.phase === 'top') {
      const ax0 = video.videoWidth / video.videoHeight;
      const mx = (a: number, b: number) => ((pose[a]!.x + pose[b]!.x) / 2) * ax0;
      const my = (a: number, b: number) => (pose[a]!.y + pose[b]!.y) / 2;
      torsos.push(Math.hypot(mx(11, 12) - mx(23, 24), my(11, 12) - my(23, 24)));
    }
    if (isUpright(frame, (exercise as RepExercise).upright?.maxTilt ?? 90, 0.5)) upright++;
    const tilt = torsoTilt(frame, 0.5);
    if (tilt !== null) tilts.push(tilt);
    if (update.metric !== null) {
      minMetric = Math.min(minMetric, update.metric);
      maxMetric = Math.max(maxMetric, update.metric);
    }
    if (time >= traceFrom && time <= traceTo) {
      const d = detector.diagnostics();
      const f = (n: number | null, digits = 0) => (n === null ? '-' : n.toFixed(digits));
      const lm = (i: number) => pose[i]!;
      const ax = video.videoWidth / video.videoHeight;
      const leg = torsos.length ? [...torsos].sort((a, b) => a - b)[Math.floor(torsos.length / 2)]! : 1;
      const fd = Math.hypot((lm(27).x - lm(28).x) * ax, lm(27).y - lm(28).y) / leg;
      const feet = `sr=${shoulderRatio(pose, ax).toFixed(2)} fd=${fd.toFixed(2)} ky=${(Math.abs(lm(25).y - lm(26).y) / leg).toFixed(2)} kv=${(lm(25).visibility ?? 0).toFixed(2)},${(lm(26).visibility ?? 0).toFixed(2)} av=${(lm(27).visibility ?? 0).toFixed(2)},${(lm(28).visibility ?? 0).toFixed(2)}`;
      trace.push(`${time.toFixed(2)} ${feet} m=${f(update.metric)} ${update.phase} top=${f(d.topLine)} stand=${f(d.standingAngle)} up=${isUpright(frame, 30, 0.5) ? 1 : 0} tilt=${f(tilt)} st=${stance(frame, 0.5, leg) ?? '-'} drift=${f(d.drift, 2)} stag=${f(d.staggeredShare, 2)}`);
    }
    // One sample per second: time, knee angle, phase, torso tilt.
    if (frames % fps === 0) timeline.push(`${Math.round(time)}s:${update.metric === null ? '-' : Math.round(update.metric)}/${update.phase[0]}/${tilt === null ? '-' : Math.round(tilt)}`);
    if (update.rep) {
      const rep = update.rep;
      reps.push(rep);
      countEl.textContent = String(rep.count);
      const item = document.createElement('li');
      item.textContent = `${time.toFixed(1)}s · ${rep.verdict.toUpperCase()} · ${Math.round(rep.bottom)}° · ${rep.cues.join(' / ') || 'clean'}`;
      if (rep.verdict !== 'good') item.className = 'bad';
      logEl.prepend(item);
    }
  }

  const summary = {
    src: decodeURIComponent(src.split('/').pop()!.split('?')[0]!),
    exercise: exerciseId,
    model,
    fps,
    frames,
    posedPct: frames ? Math.round((posed / frames) * 100) : 0,
    counted: detector.count,
    attempts: reps.length,
    uprightPct: posed ? Math.round((upright / posed) * 100) : 0,
    metricRange: [Math.round(minMetric), Math.round(maxMetric)],
    tiltMedian: tilts.length ? Math.round(tilts.sort((a, b) => a - b)[Math.floor(tilts.length / 2)]!) : null,
    timeline: timeline.join(' '),
    trace,
    reps: reps.map((r) => ({ verdict: r.verdict, bottomDeg: Math.round(r.bottom), sec: +(r.durationMs / 1000).toFixed(2), cues: r.cues })),
  };
  window.spotterResult = summary;
  resultEl.textContent = JSON.stringify(summary, null, 1);
  cueEl.textContent = `Done: ${summary.counted} counted of ${summary.attempts} attempts.`;
}

main().catch((err: unknown) => {
  cueEl.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
  window.spotterResult = { error: String(err) };
});

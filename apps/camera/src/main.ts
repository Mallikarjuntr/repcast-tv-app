import { FilesetResolver, PoseLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import { BODY_PARTS, findSession, openChannel, POSE_SOURCE_INDEX, type BodyPart, type LiveChannel, type SpotterEvent } from '@spotter/shared';
import { isSideOn, RepDetector, squat, type PointName, type RepResult, type RepUpdate } from 'spotter-movement';
import { VideoLink } from './video-link';

const MODEL_URL = {
  lite: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
  full: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
};

// Body only: shoulders, arms, torso, legs, feet.
const BONES: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [27, 29], [29, 31], [27, 31],
  [24, 26], [26, 28], [28, 30], [30, 32], [28, 32],
];

/** MediaPipe landmark indices that must be visible for each part of the TV's framing checklist. */
const PART_POINTS: Record<BodyPart, number[]> = { head: [0], hips: [23, 24], knees: [25, 26], feet: [27, 28] };
const FRAMING_MIN_GAP_MS = 400;
const FRAMING_HEARTBEAT_MS = 2000;
/** About 12 outline updates a second is smooth on a TV and light on data. */
const POSE_INTERVAL_MS = 80;

const FRIENDLY: Partial<Record<PointName, string>> = {
  leftHip: 'hips', rightHip: 'hips', leftKnee: 'knees', rightKnee: 'knees',
};

function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
}

const ui = {
  intro: $('intro'),
  session: $('session'),
  start: $<HTMLButtonElement>('start'),
  error: $('error'),
  speak: $<HTMLInputElement>('speak'),
  stage: $('stage'),
  video: $<HTMLVideoElement>('video'),
  overlay: $<HTMLCanvasElement>('overlay'),
  count: $('count'),
  cue: $('cue'),
  hint: $('hint'),
  angle: $('angle'),
  fps: $('fps'),
  phase: $('phase'),
  log: $<HTMLOListElement>('log'),
  copy: $<HTMLButtonElement>('copy'),
  reset: $<HTMLButtonElement>('reset'),
  flip: $<HTMLButtonElement>('flip'),
  pairStatus: $('pair-status'),
  pairForm: $<HTMLFormElement>('pair-form'),
  codeInput: $<HTMLInputElement>('code'),
};

/** Live connection to the TV session this phone is linked to, if any. */
let tv: LiveChannel | null = null;
/** The camera picture for the TV, straight over the home Wi-Fi (`?video=off` to test without it). */
const video = new URLSearchParams(location.search).get('video') === 'off' ? null : new VideoLink();
let lastFraming = '';
let lastFramingAt = 0;
let lastPoseAt = 0;

/** Important messages (hello, reps) fall back to HTTPS if the socket is down. */
function send(event: SpotterEvent): void {
  tv?.send(event, true);
}

/**
 * Streams the body outline to the TV: every frame over the direct video link when it is up,
 * otherwise about 12 a second over the session channel (dropped while that socket reconnects).
 */
function streamPose(pose: NormalizedLandmark[] | undefined, now: number): void {
  if (!tv || !pose) return;
  const direct = video?.sendPose(poseEvent(pose)) ?? false;
  if (direct || now - lastPoseAt < POSE_INTERVAL_MS) return;
  lastPoseAt = now;
  tv.send(poseEvent(pose));
}

function poseEvent(pose: NormalizedLandmark[]): Extract<SpotterEvent, { type: 'pose' }> {
  const p: number[] = [];
  for (const i of POSE_SOURCE_INDEX) {
    const lm = pose[i];
    const seen = lm && (lm.visibility ?? 0) >= 0.5;
    p.push(seen ? Math.round(lm.x * 1000) / 1000 : -1, seen ? Math.round(lm.y * 1000) / 1000 : -1);
  }
  return { type: 'pose', p, aspect: ui.video.videoWidth / ui.video.videoHeight, mirrored: facing === 'user', at: Date.now() };
}

async function linkToTv(code: string): Promise<void> {
  ui.pairStatus.className = 'pair-status';
  ui.pairStatus.textContent = `Looking for TV ${code}…`;
  try {
    const session = await findSession(code);
    tv?.close();
    tv = openChannel(session.channel);
    video?.connect(session.channel);
    ui.pairStatus.className = 'pair-status linked';
    ui.pairStatus.textContent = `Linked to your TV · code ${code} ✓`;
    ui.pairForm.hidden = true;
    send({ type: 'hello', device: navigator.userAgent.includes('Android') ? 'Android phone' : 'phone', at: Date.now() });
  } catch (err) {
    tv?.close();
    tv = null;
    video?.close();
    ui.pairStatus.className = 'pair-status failed';
    ui.pairStatus.textContent = `Couldn't link: ${err instanceof Error ? err.message : String(err)}`;
  }
}

/** Tells the TV which body parts are in view: on every change (throttled) and as a heartbeat. */
function reportFraming(pose: NormalizedLandmark[] | undefined, now: number): void {
  if (!tv) return;
  const visible = Object.fromEntries(
    BODY_PARTS.map((part) => [part, !!pose && PART_POINTS[part].every((i) => (pose[i]?.visibility ?? 0) >= 0.5)]),
  ) as Record<BodyPart, boolean>;
  const sideOn = !!pose && isSideOn({ t: now, landmarks: pose, aspect: ui.video.videoWidth / ui.video.videoHeight }, 0.5) === true;
  const key = JSON.stringify({ visible, sideOn });
  const changed = key !== lastFraming && now - lastFramingAt >= FRAMING_MIN_GAP_MS;
  if (changed || now - lastFramingAt >= FRAMING_HEARTBEAT_MS) {
    lastFraming = key;
    lastFramingAt = now;
    send({ type: 'framing', visible, sideOn, at: Date.now() });
  }
}

const modelKind = new URLSearchParams(location.search).get('model') === 'full' ? 'full' : 'lite';
const detector = new RepDetector(squat);
const reps: RepResult[] = [];
let landmarker: PoseLandmarker | null = null;
let stream: MediaStream | null = null;
let facing: 'user' | 'environment' = 'user';
let wakeLock: WakeLockSentinel | null = null;
let lastVideoTime = -1;
let lastFrameAt = 0;
let fps = 0;
let frames = 0;
let fallbackFrames = 0;
let noPersonFrames = 0;
/** When the person started being seen side-on (null when not). */
let sideOnSince: number | null = null;

function showError(message: string): void {
  ui.error.textContent = message;
  ui.error.hidden = false;
}

async function loadLandmarker(): Promise<PoseLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(`${import.meta.env.BASE_URL}mediapipe/wasm`);
  const options = (delegate: 'GPU' | 'CPU') => ({
    baseOptions: { modelAssetPath: MODEL_URL[modelKind], delegate },
    runningMode: 'VIDEO' as const,
    numPoses: 1,
  });
  try {
    return await PoseLandmarker.createFromOptions(vision, options('GPU'));
  } catch {
    return PoseLandmarker.createFromOptions(vision, options('CPU'));
  }
}

/**
 * Test bench: `?src=<video url>` plays a recorded exercise clip in place of the camera, through the
 * same pose model, rep engine and video link, so the TV can be tested without anyone exercising.
 * The clip's host must allow CORS (Wikimedia Commons does).
 */
const clipUrl = new URLSearchParams(location.search).get('src');

async function startClip(url: string): Promise<MediaStream> {
  facing = 'environment'; // a recording isn't a mirror
  ui.video.crossOrigin = 'anonymous';
  ui.video.loop = true;
  ui.video.src = url;
  await ui.video.play();
  return (ui.video as HTMLVideoElement & { captureStream(): MediaStream }).captureStream();
}

async function startCamera(): Promise<void> {
  stream?.getTracks().forEach((t) => t.stop());
  if (clipUrl) {
    stream = await startClip(clipUrl);
  } else {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    ui.video.srcObject = stream;
    await ui.video.play();
  }
  ui.overlay.width = ui.video.videoWidth;
  ui.overlay.height = ui.video.videoHeight;
  ui.stage.classList.toggle('mirrored', facing === 'user');
  lastVideoTime = -1;
  video?.setTrack(stream.getVideoTracks()[0] ?? null);
}

async function keepScreenOn(): Promise<void> {
  try {
    wakeLock = await navigator.wakeLock?.request('screen');
  } catch {
    // Not supported or denied: the test still works, the screen may just dim.
  }
}

function say(text: string): void {
  if (!ui.speak.checked || !('speechSynthesis' in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = speechSynthesis.getVoices().find((v) => v.lang === 'en-IN') ?? speechSynthesis.getVoices().find((v) => v.lang.startsWith('en'));
  if (voice) utterance.voice = voice;
  utterance.rate = 1.05;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

function draw(pose: NormalizedLandmark[] | undefined): void {
  const ctx = ui.overlay.getContext('2d');
  if (!ctx) return;
  const { width: w, height: h } = ui.overlay;
  ctx.clearRect(0, 0, w, h);
  if (!pose) return;

  const visible = (i: number) => (pose[i]?.visibility ?? 0) >= 0.5;
  ctx.lineCap = 'round';
  for (const [color, width] of [['#1d1b17', w * 0.014], ['#f5d547', w * 0.008]] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    for (const [a, b] of BONES) {
      const pa = pose[a];
      const pb = pose[b];
      if (!pa || !pb || !visible(a) || !visible(b)) continue;
      ctx.beginPath();
      ctx.moveTo(pa.x * w, pa.y * h);
      ctx.lineTo(pb.x * w, pb.y * h);
      ctx.stroke();
    }
  }
}

function setCue(text: string, correction = false): void {
  ui.cue.textContent = text;
  ui.cue.classList.toggle('correction', correction);
}

function describeMissing(missing: PointName[]): string {
  const parts = [...new Set(missing.map((m) => FRIENDLY[m] ?? m))];
  return `I can't see your ${parts.join(' and ')} — step back a little`;
}

function onRep(rep: RepResult): void {
  reps.push(rep);
  send({
    type: 'rep',
    exercise: squat.id,
    count: rep.count,
    counted: rep.counted,
    verdict: rep.verdict,
    depthOk: rep.depthOk,
    faults: rep.faults.map((f) => f.id),
    cues: rep.cues,
    at: Date.now(),
  });

  if (!rep.counted) {
    // An honest spotter: say plainly that it didn't count, and why.
    setCue(`No rep — ${rep.cues[0] ?? "that one doesn't count"}`, true);
    say(`No rep. ${rep.cues[0] ?? ''}`);
  } else {
    ui.count.textContent = String(rep.count);
    const countBox = ui.count.parentElement!;
    countBox.classList.add('bump');
    setTimeout(() => countBox.classList.remove('bump'), 350);
    if (rep.verdict === 'fix') {
      setCue(rep.cues.join(' · '), true);
      say(`${rep.count}. ${rep.cues[0]}`);
    } else {
      setCue(rep.count % 5 === 0 ? `${rep.count} — lovely, keep going` : 'Good rep');
      say(String(rep.count));
    }
  }

  const item = document.createElement('li');
  const label = rep.counted ? (rep.verdict === 'fix' ? rep.cues.join(', ') : 'clean') : `NO REP: ${rep.cues[0] ?? ''}`;
  item.textContent = `${Math.round(rep.bottom)}° · ${(rep.durationMs / 1000).toFixed(1)}s · ${label}`;
  if (rep.verdict !== 'good') item.className = 'bad';
  ui.log.prepend(item);
}

function render(update: RepUpdate): void {
  ui.angle.textContent = update.metric === null ? '–' : `${Math.round(update.metric)}°${update.usingFallback ? '*' : ''}`;
  ui.phase.textContent = update.phase;
  if (update.usingFallback) fallbackFrames++;

  if (update.rep) {
    onRep(update.rep);
  } else if (update.metric === null && update.missing.length > 0) {
    setCue(describeMissing(update.missing), true);
  } else if (update.phase === 'waiting') {
    setCue('Stand tall to begin');
  } else if (update.phase === 'down' && ui.cue.classList.contains('correction') === false && reps.length === 0) {
    setCue('Down…');
  } else if (update.phase === 'top' && reps.length === 0) {
    setCue('Ready — squat when you are');
  }
  ui.hint.textContent = sideOnSince !== null && performance.now() - sideOnSince > 2000
    ? 'Turn the phone about 45° — from the side I can’t see both legs'
    : update.usingFallback
      ? 'Feet out of view — estimating from your thighs (*)'
      : '';
}

function loop(): void {
  const video = ui.video;
  if (landmarker && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const now = performance.now();
    const result = landmarker.detectForVideo(video, now);
    const pose = result.landmarks[0];
    draw(pose);
    reportFraming(pose, now);
    streamPose(pose, now);
    frames++;
    if (pose) {
      noPersonFrames = 0;
      const side = isSideOn({ t: now, landmarks: pose, aspect: video.videoWidth / video.videoHeight }, 0.5) === true;
      sideOnSince = side ? (sideOnSince ?? now) : null;
      render(detector.update({ t: now, landmarks: pose, world: result.worldLandmarks[0], aspect: video.videoWidth / video.videoHeight }));
    } else if (++noPersonFrames > 15) {
      setCue("I can't see you yet — step into the frame", true);
    }
    if (lastFrameAt) fps = fps ? fps * 0.9 + (1000 / (now - lastFrameAt)) * 0.1 : 1000 / (now - lastFrameAt);
    lastFrameAt = now;
    ui.fps.textContent = fps.toFixed(0);
  }
  requestAnimationFrame(loop);
}

function results(): string {
  return JSON.stringify(
    {
      exercise: squat.id,
      model: modelKind,
      camera: facing,
      device: navigator.userAgent,
      video: `${ui.video.videoWidth}x${ui.video.videoHeight}`,
      avgFps: Math.round(fps),
      frames,
      feetHiddenPct: frames ? Math.round((fallbackFrames / frames) * 100) : 0,
      attempts: reps.length,
      counted: reps.filter((r) => r.counted).length,
      reps: reps.map((r) => ({
        n: r.count,
        verdict: r.verdict,
        bottomDeg: Math.round(r.bottom),
        deep: r.depthOk,
        faults: r.faults.map((f) => `${f.id}:${f.severity}`),
        cues: r.cues,
        sec: +(r.durationMs / 1000).toFixed(2),
      })),
    },
    null,
    1,
  );
}

ui.start.addEventListener('click', async () => {
  ui.error.hidden = true;
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    showError('The camera needs a secure (https) page. Open the link GitHub Pages gave you.');
    return;
  }
  facing = (document.querySelector<HTMLInputElement>('input[name="facing"]:checked')?.value as typeof facing) ?? 'user';
  ui.start.disabled = true;
  ui.start.textContent = 'Loading the pose model…';
  say('');
  try {
    landmarker ??= await loadLandmarker();
    await startCamera();
  } catch (err) {
    ui.start.disabled = false;
    ui.start.textContent = 'Start camera';
    const name = err instanceof DOMException ? err.name : '';
    showError(name === 'NotAllowedError' ? 'Camera permission was blocked. Allow it in the browser settings and try again.' : `Couldn't start: ${String(err)}`);
    return;
  }
  ui.intro.hidden = true;
  ui.session.hidden = false;
  lastFramingAt = 0;
  send({ type: 'hello', device: 'camera started', at: Date.now() });
  await keepScreenOn();
  requestAnimationFrame(loop);
});

ui.reset.addEventListener('click', () => {
  detector.reset();
  reps.length = 0;
  frames = 0;
  fallbackFrames = 0;
  ui.count.textContent = '0';
  ui.log.replaceChildren();
  setCue('Stand tall to begin');
});

ui.flip.addEventListener('click', async () => {
  facing = facing === 'user' ? 'environment' : 'user';
  detector.reset();
  try {
    await startCamera();
  } catch (err) {
    setCue(`Couldn't switch camera: ${String(err)}`, true);
  }
});

ui.copy.addEventListener('click', async () => {
  const text = results();
  try {
    await navigator.clipboard.writeText(text);
    ui.copy.textContent = 'Copied — paste it to Claude';
  } catch {
    window.prompt('Copy these results:', text);
  }
  setTimeout(() => (ui.copy.textContent = 'Copy results'), 2500);
});

ui.pairForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const code = ui.codeInput.value.trim();
  if (!/^\d{4}$/.test(code)) {
    ui.pairStatus.className = 'pair-status failed';
    ui.pairStatus.textContent = 'Enter the 4-digit code shown on your TV.';
    return;
  }
  void linkToTv(code);
});

const codeFromQr = new URLSearchParams(location.search).get('code');
if (codeFromQr && /^\d{4}$/.test(codeFromQr)) void linkToTv(codeFromQr);
// A clip needs no camera permission, so the test bench starts by itself.
if (clipUrl) ui.start.click();

window.addEventListener('pagehide', () => {
  send({ type: 'bye', at: Date.now() });
  video?.close();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && stream && !wakeLock) void keepScreenOn();
});

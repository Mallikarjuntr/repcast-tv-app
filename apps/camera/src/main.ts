import { FilesetResolver, PoseLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import { BODY_PARTS, controlChannel, findSession, isPairingCode, openChannel, POSE_SOURCE_INDEX, type BodyPart, type ExerciseCommand, type LiveChannel, type SpotterEvent } from '@spotter/shared';
import { EXERCISES, isSideOn, RepDetector, squat, type PointName, type RepExercise, type RepResult, type RepUpdate } from 'repcast-movement';
import { DisplayPose } from './display-pose';
import { framing, inView, Steady, SteadyHint } from './framing';
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
/** No word from the TV for this long (it repeats every 2 s): it has left the session. */
const TV_SILENT_MS = 8000;
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
  stage: $('stage'),
  video: $<HTMLVideoElement>('video'),
  overlay: $<HTMLCanvasElement>('overlay'),
  count: $('count'),
  countOf: $('count-of'),
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
  statusTag: $('status-tag'),
  codeInput: $<HTMLInputElement>('code'),
};

/** Live connection to the TV session this phone is linked to, if any. */
let tv: LiveChannel | null = null;
/** The camera picture for the TV, straight over the home Wi-Fi (`?video=off` to test without it). */
const video = new URLSearchParams(location.search).get('video') === 'off' ? null : new VideoLink();
let lastFraming = '';
let lastFramingAt = 0;
const steadyHint = new SteadyHint();
// "Ready" waits a moment before changing either way, so the TV's countdown and buttons don't flicker
// when the knees drop out of view at the bottom of a squat.
const steadyReady = new Steady(false, 1200);
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
    const seen = lm && inView(lm);
    p.push(seen ? Math.round(lm.x * 1000) / 1000 : -1, seen ? Math.round(lm.y * 1000) / 1000 : -1);
  }
  return { type: 'pose', p, aspect: ui.video.videoWidth / ui.video.videoHeight, mirrored: facing === 'user', at: Date.now() };
}

async function linkToTv(code: string): Promise<void> {
  linkedCode = code;
  ui.pairStatus.className = 'pair-status';
  ui.pairStatus.textContent = `Looking for TV ${code}…`;
  try {
    const session = await findSession(code);
    tv?.close();
    tv = openChannel(session.channel);
    // The TV says which exercise to judge as the session moves on.
    control?.close();
    control = openChannel(controlChannel(session.channel), {
      onEvent: (event) => {
        if (event.type === 'exercise') onTvCommand(event);
      },
    });
    video?.connect(session.channel);
    ui.pairStatus.className = 'pair-status linked';
    ui.pairStatus.textContent = `Linked to your TV · code ${code}`;
    ui.pairForm.hidden = true;
    send({ type: 'hello', device: navigator.userAgent.includes('Android') ? 'Android phone' : 'phone', at: Date.now() });
    showTvState();
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
    BODY_PARTS.map((part) => [part, !!pose && PART_POINTS[part].every((i) => inView(pose[i]))]),
  ) as Record<BodyPart, boolean>;
  const sideOn = !!pose && isSideOn({ t: now, landmarks: pose, aspect: ui.video.videoWidth / ui.video.videoHeight }, 0.5) === true;
  const view = framing(pose, exercise?.required ?? UNJUDGED_REQUIRED, sideOn && needsFrontView(), !exercise?.lying);
  const hint = steadyHint.update(view.hint, now);
  const ready = steadyReady.update(view.ready, now);
  framingHint = hint;
  const key = JSON.stringify({ visible, sideOn, ready, hint });
  const changed = key !== lastFraming && now - lastFramingAt >= FRAMING_MIN_GAP_MS;
  if (changed || now - lastFramingAt >= FRAMING_HEARTBEAT_MS) {
    lastFraming = key;
    lastFramingAt = now;
    send({ type: 'framing', visible, sideOn, ready, hint, at: Date.now() });
  }
}

const modelKind = new URLSearchParams(location.search).get('model') === 'full' ? 'full' : 'lite';

/**
 * Moves judged as well from the side as from the front: the lunges (which foot is in front shows in
 * the knee heights from any angle). Floor moves are filmed side-on on purpose. The rest need to see
 * across the body (knees caving, stance width, feet jumping out, a foot crossing behind), so a
 * side-on phone is asked to turn.
 */
const SIDE_VIEW_OK = new Set(['lunge', 'reverse-lunge', 'split-squat']);
function needsFrontView(): boolean {
  return !!exercise && !exercise.lying && !SIDE_VIEW_OK.has(exercise.id);
}
/** What the coach is judging now: squats until the TV says otherwise; null between judged moves. */
let exercise: RepExercise | null = squat;
let detector = new RepDetector(squat);
/** TV → phone commands (which exercise to judge). */
let control: LiveChannel | null = null;
/** Between judged moves the coach only needs to see the person. */
const UNJUDGED_REQUIRED: PointName[] = ['leftHip', 'rightHip'];

function setExercise(id: string | null): void {
  const next = id ? EXERCISES[id] : undefined;
  const judged = next?.type === 'rep' ? next : null;
  if (judged?.id === exercise?.id && (judged !== null) === (exercise !== null)) return;
  exercise = judged;
  if (judged) detector = new RepDetector(judged);
  reps.length = 0;
  ui.log.replaceChildren();
}

/**
 * The TV runs the session and keeps the count; the phone follows it. Older TVs send only the
 * exercise id (no phase): then the phone judges that exercise all the time, as it used to.
 */
let tvCommand: ExerciseCommand | null = null;
let tvCommandAt = 0;
/** The latest steadied framing hint, to show while getting ready. */
let framingHint: string | undefined;

const isWork = (cmd: ExerciseCommand) => cmd.id !== null && (cmd.phase === undefined || cmd.phase === 'work');

function onTvCommand(cmd: ExerciseCommand): void {
  const prev = tvCommand;
  tvCommand = cmd;
  tvCommandAt = performance.now();
  setExercise(cmd.id);
  // Every set starts the engine afresh, so moving about during a rest can't finish a rep.
  const freshSet = isWork(cmd) && (!prev || !isWork(prev) || prev.set !== cmd.set || prev.id !== cmd.id);
  if (freshSet && exercise) {
    detector = new RepDetector(exercise);
    setCue(`Go — ${cmd.name?.toLowerCase() ?? exercise.name.toLowerCase()}`);
  }
  showTvState();
}

/** Whether the phone should be judging reps right now. */
function judging(now: number): boolean {
  if (!tv) return exercise !== null; // On its own (no TV): a squat test bench.
  if (!tvCommand || now - tvCommandAt > TV_SILENT_MS) return false;
  return isWork(tvCommand) && exercise !== null;
}

const HINT_TEXT: Record<string, string> = {
  'step-in': 'Step into view of the phone',
  'step-back': 'Step back a little, so the phone sees all of you',
  'come-closer': 'Come a little closer to the phone',
  'move-left': 'Move a little to your left',
  'move-right': 'Move a little to your right',
  'turn-phone': 'Turn the phone about 45° to you',
};

/** Shows what the TV is doing: the set and its count, a rest or countdown, or a pause. */
function showTvState(): void {
  if (!tv) return;
  const now = performance.now();
  const cmd = tvCommand;
  const countBox = ui.count.parentElement!;
  // Never shows 0: the TV moves on at zero, and its next message replaces this.
  const left = cmd?.secondsLeft !== undefined ? Math.max(1, Math.ceil(cmd.secondsLeft - (now - tvCommandAt) / 1000)) : null;
  const show = (tag: string, count: string | null, of: string, cue?: string) => {
    ui.statusTag.textContent = tag;
    countBox.hidden = count === null;
    if (count !== null) ui.count.textContent = count;
    ui.countOf.textContent = of;
    if (cue !== undefined) setCue(cue);
  };
  if (!cmd) return show('LINKED TO TV', null, '', 'Start a session on your TV');
  // A finished session stays finished; any other silence means the TV has gone.
  if (cmd.phase !== 'done' && now - tvCommandAt > TV_SILENT_MS) return show('TV NOT FOUND', null, '', 'Lost your TV — is RepCast still open on it?');
  const name = (cmd.name ?? exercise?.name ?? '').toUpperCase();
  switch (cmd.phase) {
    case undefined:
      return show(cmd.id ? name : 'FOLLOWING ALONG', ui.count.textContent ?? '0', 'reps', cmd.id ? undefined : 'Follow the trainer on the TV');
    case 'pair':
      return show('GET READY', null, '', HINT_TEXT[framingHint ?? ''] ?? `Stand where the phone can see you${cmd.name ? ` — ${cmd.name.toLowerCase()}` : ''}`);
    case 'countdown':
      return show('GET READY', String(left ?? ''), 'starting', `Starting in ${left ?? ''}${cmd.name ? ` — ${cmd.name.toLowerCase()}` : ''}`);
    case 'work':
      return show(cmd.set && cmd.sets ? `${name} · SET ${cmd.set} OF ${cmd.sets}` : name, String(cmd.count ?? 0), cmd.target ? `/ ${cmd.target}` : 'reps');
    case 'rest':
      return show('REST', String(left ?? ''), 'seconds', `Rest — next: ${cmd.next ?? 'the next set'}`);
    case 'paused':
      return show('PAUSED', String(cmd.count ?? 0), cmd.target ? `/ ${cmd.target}` : 'reps', 'Paused on your TV');
    case 'done':
      return show('DONE', null, '', 'Session done — see your TV for the results');
  }
}
const reps: RepResult[] = [];
let landmarker: PoseLandmarker | null = null;
let stream: MediaStream | null = null;
let facing: 'user' | 'environment' = 'user';
let wakeLock: WakeLockSentinel | null = null;
let lastVideoTime = -1;
/** When the camera last gave a new frame: a long gap while on screen means it stalled. */
let lastNewFrameAt = 0;
/** GPU unless the phone couldn't run the model there (much slower on CPU). */
let delegate: 'GPU' | 'CPU' | null = null;
/** The TV's pairing code, to link again after the page is restored. */
let linkedCode: string | null = null;
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
    const gpu = await PoseLandmarker.createFromOptions(vision, options('GPU'));
    delegate = 'GPU';
    return gpu;
  } catch {
    delegate = 'CPU';
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
      // MediaPipe works on a 256-pixel copy and the TV gets 480p at most: a smaller capture
      // leaves the phone more time for both.
      video: { facingMode: facing, width: { ideal: 960 }, height: { ideal: 540 } },
    });
    ui.video.srcObject = stream;
    await ui.video.play();
  }
  ui.overlay.width = ui.video.videoWidth;
  ui.overlay.height = ui.video.videoHeight;
  ui.stage.classList.toggle('mirrored', facing === 'user');
  lastVideoTime = -1;
  lastNewFrameAt = performance.now();
  const track = stream.getVideoTracks()[0] ?? null;
  track?.addEventListener('ended', () => void resume());
  video?.setTrack(track);
}

async function keepScreenOn(): Promise<void> {
  try {
    wakeLock = (await navigator.wakeLock?.request('screen')) ?? null;
    // The system drops it whenever the page is hidden (screen off, another app); then ask again on return.
    wakeLock?.addEventListener('release', () => (wakeLock = null));
  } catch {
    // Not supported or denied: the test still works, the screen may just dim.
  }
}

const displayPose = new DisplayPose();

function draw(pose: NormalizedLandmark[] | undefined): void {
  const ctx = ui.overlay.getContext('2d');
  if (!ctx) return;
  const { width: w, height: h } = ui.overlay;
  // The frame the pose came from is painted under the skeleton, so the two can't drift apart on
  // screen (the <video> behind keeps playing while MediaPipe works on a frame).
  ctx.drawImage(ui.video, 0, 0, w, h);
  if (!pose) return;

  const visible = (i: number) => (pose[i]?.visibility ?? 0) >= 0.5;
  ctx.lineCap = 'round';
  for (const [color, width] of [['#15120f', w * 0.014], ['#ff7a3d', w * 0.008]] as const) {
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
    exercise: exercise?.id ?? 'none',
    count: rep.count,
    counted: rep.counted,
    verdict: rep.verdict,
    depthOk: rep.depthOk,
    faults: rep.faults.map((f) => f.id),
    cues: rep.cues,
    // For the TV's "Analyse with AI" report: depth and pace, rounded.
    bottom: Math.round(rep.bottom),
    durationMs: Math.round(rep.durationMs),
    at: Date.now(),
  });

  // The TV speaks; the phone shows the verdict. Linked to a TV, the count shown is the TV's (it
  // arrives a moment later); on its own the phone counts.
  if (!rep.counted) {
    // An honest coach: say plainly that it didn't count, and why.
    setCue(`No rep — ${rep.cues[0] ?? "that one doesn't count"}`, true);
  } else {
    if (!tv) ui.count.textContent = String(rep.count);
    const countBox = ui.count.parentElement!;
    countBox.classList.add('bump');
    setTimeout(() => countBox.classList.remove('bump'), 350);
    if (rep.verdict === 'fix') setCue(rep.cues.join(' · '), true);
    else setCue('Good rep');
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
    setCue(`Ready — ${exercise?.name.toLowerCase() ?? 'go'} when you are`);
  }
  ui.hint.textContent = needsFrontView() && sideOnSince !== null && performance.now() - sideOnSince > 2000
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
    lastNewFrameAt = now;
    const result = landmarker.detectForVideo(video, now);
    const pose = result.landmarks[0];
    // People see the steadied skeleton (here and on the TV); framing and the rep engine use raw points.
    const shown = displayPose.update(pose, now);
    draw(shown);
    reportFraming(pose, now);
    streamPose(shown, now);
    frames++;
    if (pose) {
      noPersonFrames = 0;
      const side = isSideOn({ t: now, landmarks: pose, aspect: video.videoWidth / video.videoHeight }, 0.5) === true;
      sideOnSince = side ? (sideOnSince ?? now) : null;
      if (judging(now)) render(detector.update({ t: now, landmarks: pose, world: result.worldLandmarks[0], aspect: video.videoWidth / video.videoHeight }));
    } else if (++noPersonFrames > 15 && (!tv || judging(now))) {
      setCue("I can't see you yet — step into the frame", true);
    }
    // Rests and countdowns tick down between the TV's messages.
    if (tv && !judging(now)) showTvState();
    if (lastFrameAt) fps = fps ? fps * 0.9 + (1000 / (now - lastFrameAt)) * 0.1 : 1000 / (now - lastFrameAt);
    lastFrameAt = now;
    ui.fps.textContent = fps.toFixed(0);
  }
  requestAnimationFrame(loop);
}

function results(): string {
  return JSON.stringify(
    {
      exercise: exercise?.id ?? 'none',
      model: modelKind,
      delegate,
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
        // What the feet did, for tuning: step, still, ahead, across, out, split (see repcast-movement footwork).
        feet: r.feet && {
          step: +r.feet.step.toFixed(2),
          still: +r.feet.still.toFixed(2),
          ahead: +r.feet.ahead.toFixed(2),
          across: r.feet.across === null ? null : +r.feet.across.toFixed(2),
          out: r.feet.out && r.feet.out.map((o) => +o.toFixed(2)),
          split: +r.feet.split.toFixed(2),
        },
      })),
    },
    null,
    1,
  );
}

/** Starts the camera; `auto` (opened from the TV's QR code) fails quietly back to the button. */
async function startSession(auto: boolean): Promise<void> {
  ui.error.hidden = true;
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    showError('The camera needs a secure (https) page. Open the link GitHub Pages gave you.');
    return;
  }
  facing = (document.querySelector<HTMLInputElement>('input[name="facing"]:checked')?.value as typeof facing) ?? 'user';
  ui.start.disabled = true;
  ui.start.textContent = 'Loading the pose model…';
  try {
    landmarker ??= await loadLandmarker();
    await startCamera();
  } catch (err) {
    ui.start.disabled = false;
    ui.start.textContent = 'Start camera';
    const name = err instanceof DOMException ? err.name : '';
    // Some browsers only open the camera after a tap; then the button is the way in.
    if (auto && name !== 'NotAllowedError') return;
    showError(name === 'NotAllowedError' ? 'Camera permission was blocked. Allow it in the browser settings and try again.' : `Couldn't start: ${String(err)}`);
    return;
  }
  ui.intro.hidden = true;
  ui.session.hidden = false;
  lastFramingAt = 0;
  send({ type: 'hello', device: 'camera started', at: Date.now() });
  showTvState();
  await keepScreenOn();
  requestAnimationFrame(loop);
}

ui.start.addEventListener('click', () => void startSession(false));

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
    ui.copy.textContent = 'Copied';
  } catch {
    window.prompt('Copy these results:', text);
  }
  setTimeout(() => (ui.copy.textContent = 'Copy results'), 2500);
});

ui.pairForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const code = ui.codeInput.value.trim();
  if (!isPairingCode(code)) {
    ui.pairStatus.className = 'pair-status failed';
    ui.pairStatus.textContent = 'Enter the code shown on your TV.';
    return;
  }
  void linkToTv(code);
});

const codeFromQr = new URLSearchParams(location.search).get('code');
if (codeFromQr && isPairingCode(codeFromQr)) {
  // Opened from the TV's QR code: link and start the camera straight away (the browser still asks
  // for camera permission the first time).
  void linkToTv(codeFromQr).then(() => {
    if (tv && !clipUrl) void startSession(true);
  });
}
// A clip needs no camera permission, so the test bench starts by itself.
if (clipUrl) void startSession(true);

window.addEventListener('pagehide', () => {
  send({ type: 'bye', at: Date.now() });
  video?.close();
});

// Restored from the back/forward cache: the links to the TV were closed on the way out.
window.addEventListener('pageshow', (e) => {
  if (!e.persisted || !linkedCode) return;
  void linkToTv(linkedCode).then(() => resume(true));
});

/**
 * Back from the screen going off or another app. Android pauses the video and may stop the camera
 * while the page is hidden, and nothing restarts them by itself: the phone stopped judging and the
 * TV kept the last picture until the page was reloaded. `force` reopens the camera even if its
 * track still claims to be live.
 */
let resuming = false;
async function resume(force = false): Promise<void> {
  if (!stream || resuming || document.visibilityState !== 'visible') return;
  resuming = true;
  try {
    if (!wakeLock) await keepScreenOn();
    const track = stream.getVideoTracks()[0];
    if (!clipUrl && (force || !track || track.readyState === 'ended')) await startCamera();
    else await ui.video.play();
    lastNewFrameAt = performance.now();
  } catch (err) {
    setCue(`Couldn't restart the camera — ${err instanceof Error ? err.message : String(err)}. Reload the page.`, true);
  } finally {
    resuming = false;
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void resume();
});

// A camera that stops while the page is on screen gets reopened: its track ended or stayed muted
// (the video's clock keeps running on a dead camera stream, so frame times alone can't tell), or no
// new frame arrived.
const STALLED_MS = 2500;
let mutedSince: number | null = null;
setInterval(() => {
  if (!stream || clipUrl || document.visibilityState !== 'visible') return;
  const now = performance.now();
  const track = stream.getVideoTracks()[0];
  mutedSince = track?.muted ? (mutedSince ?? now) : null;
  const dead = !track || track.readyState === 'ended' || (mutedSince !== null && now - mutedSince > STALLED_MS);
  if (dead || now - lastNewFrameAt > STALLED_MS) void resume(true);
}, 1000);

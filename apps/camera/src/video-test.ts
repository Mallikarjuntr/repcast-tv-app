// Phase 0 spike, not part of the product: sends a test pattern (or a camera) to the TV's hidden
// video-test screen over WebRTC, signalled on the session channel, and shows sender stats.
import { findSession, openChannel, type LiveChannel, type RtcSignal } from '@spotter/shared';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

function $<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

const ui = {
  form: $<HTMLFormElement>('link'),
  code: $<HTMLInputElement>('code'),
  source: $<HTMLSelectElement>('source'),
  size: $<HTMLSelectElement>('size'),
  fps: $<HTMLInputElement>('fps'),
  kbps: $<HTMLInputElement>('kbps'),
  canvas: $<HTMLCanvasElement>('pattern'),
  status: $('status'),
};

let channel: LiveChannel | null = null;
let pc: RTCPeerConnection | null = null;
let media: MediaStream | null = null;
let statusLine = 'Not linked.';
let statsLine = '';

function show(): void {
  ui.status.textContent = `${statusLine}\n${statsLine}`;
}

function signal(msg: Omit<RtcSignal, 'type' | 'from' | 'at'>): void {
  channel?.send({ type: 'rtc', from: 'phone', at: Date.now(), ...msg }, true);
}

/** A moving picture with a millisecond clock, so latency can be read off a TV screenshot. */
function patternStream(width: number, height: number, fps: number): MediaStream {
  ui.canvas.width = width;
  ui.canvas.height = height;
  const ctx = ui.canvas.getContext('2d')!;
  let frame = 0;
  const draw = () => {
    const t = performance.now() / 1000;
    ctx.fillStyle = '#efe8da';
    ctx.fillRect(0, 0, width, height);
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = i % 2 ? '#c0321b' : '#1d1b17';
      const x = (width / 2) + Math.cos(t * (0.6 + i * 0.13) + i) * width * 0.4;
      const y = (height / 2) + Math.sin(t * (0.9 + i * 0.07) + i) * height * 0.35;
      ctx.beginPath();
      ctx.arc(x, y, height * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#1d1b17';
    ctx.font = `bold ${Math.round(height * 0.14)}px ui-monospace, Menlo, monospace`;
    ctx.fillText(String(Date.now() % 100000).padStart(5, '0'), width * 0.04, height * 0.18);
    ctx.font = `${Math.round(height * 0.06)}px ui-monospace, Menlo, monospace`;
    ctx.fillText(`frame ${frame++}  ${width}x${height}`, width * 0.04, height * 0.94);
    requestAnimationFrame(draw);
  };
  draw();
  return ui.canvas.captureStream(fps);
}

async function getSource(): Promise<MediaStream> {
  const [width, height] = ui.size.value.split('x').map(Number) as [number, number];
  const fps = Number(ui.fps.value);
  if (ui.source.value === 'camera') {
    return navigator.mediaDevices.getUserMedia({ audio: false, video: { width: { ideal: width }, height: { ideal: height }, frameRate: { ideal: fps } } });
  }
  return patternStream(width, height, fps);
}

/** Puts H.264 first: the Fire TV Stick decodes it in hardware. */
function preferH264(transceiver: RTCRtpTransceiver): void {
  const codecs = RTCRtpReceiver.getCapabilities('video')?.codecs ?? [];
  const h264 = codecs.filter((c) => c.mimeType === 'video/H264');
  if (h264.length && 'setCodecPreferences' in transceiver) {
    transceiver.setCodecPreferences([...h264, ...codecs.filter((c) => c.mimeType !== 'video/H264')]);
  }
}

async function offer(): Promise<void> {
  if (!media) return;
  pc?.close();
  const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  pc = peer;
  const track = media.getVideoTracks()[0]!;
  const transceiver = peer.addTransceiver(track, { direction: 'sendonly', streams: [media] });
  preferH264(transceiver);
  peer.onicecandidate = (e) => signal({ candidate: e.candidate ? { candidate: e.candidate.candidate, sdpMid: e.candidate.sdpMid, sdpMLineIndex: e.candidate.sdpMLineIndex } : null });
  peer.onconnectionstatechange = () => {
    statusLine = `Linked · peer ${peer.connectionState}`;
    show();
  };
  const params = transceiver.sender.getParameters();
  params.encodings = [{ ...(params.encodings?.[0] ?? {}), maxBitrate: Number(ui.kbps.value) * 1000, maxFramerate: Number(ui.fps.value) }];
  await transceiver.sender.setParameters(params).catch(() => {});
  const description = await peer.createOffer();
  await peer.setLocalDescription(description);
  signal({ sdp: { type: 'offer', sdp: description.sdp ?? '' } });
  statusLine = 'Linked · offer sent';
  show();
}

async function link(code: string): Promise<void> {
  statusLine = `Looking for TV ${code}…`;
  show();
  const session = await findSession(code);
  media ??= await getSource();
  channel?.close();
  channel = openChannel(session.channel, {
    onStatus: (status) => {
      if (status === 'live') void offer();
    },
    onEvent: (event) => {
      if (event.type !== 'rtc' || event.from !== 'tv') return;
      if (event.want === 'offer') void offer();
      // An answer to an older offer (both sides asked at once) is ignored; the newer one follows.
      else if (event.sdp?.type === 'answer' && pc?.signalingState === 'have-local-offer') pc.setRemoteDescription(event.sdp).catch((err: unknown) => (statusLine = `Answer failed: ${String(err)}`));
      else if (event.candidate !== undefined) pc?.addIceCandidate(event.candidate ?? undefined).catch(() => {});
    },
  });
}

let previous: { bytes: number; at: number } | null = null;
setInterval(async () => {
  if (!pc) return;
  const report = await pc.getStats();
  let out: any = null;
  let pair: any = null;
  report.forEach((r: any) => {
    if (r.type === 'outbound-rtp' && r.kind === 'video') out = r;
    if (r.type === 'candidate-pair' && r.nominated && r.state === 'succeeded') pair = r;
  });
  if (!out) return;
  const now = Date.now();
  const kbps = previous ? Math.round(((out.bytesSent - previous.bytes) * 8) / (now - previous.at)) : 0;
  previous = { bytes: out.bytesSent, at: now };
  statsLine = `sent ${out.frameWidth}x${out.frameHeight} @ ${Math.round(out.framesPerSecond ?? 0)} fps · ${kbps} kbps · encoder ${out.encoderImplementation ?? '?'} · limited by ${out.qualityLimitationReason ?? '?'} · rtt ${pair?.currentRoundTripTime != null ? Math.round(pair.currentRoundTripTime * 1000) : '?'} ms`;
  show();
}, 2000);

ui.form.addEventListener('submit', (e) => {
  e.preventDefault();
  const code = ui.code.value.trim();
  if (!/^\d{4}$/.test(code)) return;
  link(code).catch((err: unknown) => {
    statusLine = `Couldn't link: ${String(err)}`;
    show();
  });
});

const codeFromUrl = new URLSearchParams(location.search).get('code');
if (codeFromUrl) ui.code.value = codeFromUrl;

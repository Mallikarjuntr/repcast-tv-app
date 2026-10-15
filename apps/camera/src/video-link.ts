import { openChannel, rtcChannel, type LiveChannel, type RtcSignal } from '@spotter/shared';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
/** A dropped connection gets this long to recover by itself before the phone offers again. */
const RECOVER_MS = 5000;
const RETRY_MS = 1000;

export interface VideoLinkOptions {
  /** Video sent to the TV is scaled down to about this height (MediaPipe keeps the full frame). */
  maxHeight?: number;
  maxBitrate?: number;
  maxFramerate?: number;
  onState?: (state: RTCPeerConnectionState | 'waiting') => void;
}

/**
 * Sends the camera to the TV over WebRTC, straight across the home Wi-Fi. Set-up messages go
 * over the session's rtc sub-channel: the phone offers whenever it (re)joins or the TV asks, and
 * offers again if the connection fails. Switching cameras swaps the track without renegotiating.
 */
export class VideoLink {
  private channel: LiveChannel | null = null;
  private live = false;
  private pc: RTCPeerConnection | null = null;
  private sender: RTCRtpSender | null = null;
  private link = '';
  /** TV candidates can arrive before its answer; they wait here until it is applied. */
  private pending: RTCIceCandidateInit[] = [];
  private track: MediaStreamTrack | null = null;
  private retry: ReturnType<typeof setTimeout> | undefined;
  private readonly options: Required<Omit<VideoLinkOptions, 'onState'>> & Pick<VideoLinkOptions, 'onState'>;

  constructor(options: VideoLinkOptions = {}) {
    this.options = { maxHeight: 480, maxBitrate: 1_200_000, maxFramerate: 24, ...options };
  }

  /** Joins the session's video set-up channel. */
  connect(sessionChannel: string): void {
    this.close();
    this.channel = openChannel(rtcChannel(sessionChannel), {
      onStatus: (status) => {
        this.live = status === 'live';
        if (this.live) void this.offer();
      },
      onEvent: (event) => {
        if (event.type === 'rtc' && event.from === 'tv') void this.onSignal(event);
      },
    });
  }

  /** The camera track to send; call again after switching cameras. */
  setTrack(track: MediaStreamTrack | null): void {
    this.track = track;
    if (this.sender && track) {
      void this.sender.replaceTrack(track).then(() => this.applyEncoding());
    } else {
      void this.offer();
    }
  }

  /** WebRTC stats of the current connection, for test benches. */
  stats(): Promise<RTCStatsReport> | undefined {
    return this.pc?.getStats();
  }

  close(): void {
    clearTimeout(this.retry);
    this.pc?.close();
    this.pc = null;
    this.sender = null;
    this.channel?.close();
    this.channel = null;
    this.live = false;
  }

  private signal(msg: Omit<RtcSignal, 'type' | 'from' | 'at' | 'link'>): void {
    this.channel?.send({ type: 'rtc', from: 'phone', link: this.link, at: Date.now(), ...msg }, true);
  }

  private async onSignal(event: RtcSignal): Promise<void> {
    if (event.want === 'offer') {
      await this.offer();
    } else if (event.link !== this.link || !this.pc) {
      // From an older attempt: ignore.
    } else if (event.sdp?.type === 'answer' && this.pc.signalingState === 'have-local-offer') {
      const pc = this.pc;
      try {
        await pc.setRemoteDescription(event.sdp);
        for (const c of this.pending.splice(0)) await pc.addIceCandidate(c).catch(() => {});
      } catch {
        this.retryOffer(RETRY_MS);
      }
    } else if (event.candidate) {
      if (this.pc.remoteDescription) await this.pc.addIceCandidate(event.candidate).catch(() => {});
      else this.pending.push(event.candidate);
    }
  }

  private retryOffer(delay: number): void {
    clearTimeout(this.retry);
    this.retry = setTimeout(() => void this.offer(), delay);
  }

  private async offer(): Promise<void> {
    clearTimeout(this.retry);
    if (!this.live || !this.track) {
      this.options.onState?.('waiting');
      return;
    }
    this.pc?.close();
    this.pending = [];
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.pc = pc;
    this.link = Math.random().toString(36).slice(2, 10);
    // The TV renders a stream, so the track goes out as part of one.
    const transceiver = pc.addTransceiver(this.track, { direction: 'sendonly', streams: [new MediaStream([this.track])] });
    this.sender = transceiver.sender;
    preferH264(transceiver);
    pc.onicecandidate = (e) =>
      this.signal({ candidate: e.candidate ? { candidate: e.candidate.candidate, sdpMid: e.candidate.sdpMid, sdpMLineIndex: e.candidate.sdpMLineIndex } : null });
    pc.onconnectionstatechange = () => {
      if (pc !== this.pc) return;
      this.options.onState?.(pc.connectionState);
      if (pc.connectionState === 'connected') clearTimeout(this.retry);
      else if (pc.connectionState === 'failed') this.retryOffer(RETRY_MS);
      else if (pc.connectionState === 'disconnected') this.retryOffer(RECOVER_MS);
    };
    await this.applyEncoding();
    const description = await pc.createOffer();
    await pc.setLocalDescription(description);
    this.signal({ sdp: { type: 'offer', sdp: description.sdp ?? '' } });
    this.options.onState?.('connecting');
  }

  /** Caps size, frame rate and bitrate so the phone keeps up with MediaPipe and the TV with decoding. */
  private async applyEncoding(): Promise<void> {
    if (!this.sender || !this.track) return;
    const { width = 0, height = 0 } = this.track.getSettings();
    const shortSide = Math.min(width, height) || this.options.maxHeight;
    const params = this.sender.getParameters();
    params.encodings = [
      {
        ...(params.encodings?.[0] ?? {}),
        maxBitrate: this.options.maxBitrate,
        maxFramerate: this.options.maxFramerate,
        scaleResolutionDownBy: Math.max(1, shortSide / this.options.maxHeight),
      },
    ];
    await this.sender.setParameters(params).catch(() => {});
  }
}

/** Puts H.264 first: the Fire TV Stick decodes it in hardware. */
function preferH264(transceiver: RTCRtpTransceiver): void {
  const codecs = RTCRtpReceiver.getCapabilities('video')?.codecs ?? [];
  const h264 = codecs.filter((c) => c.mimeType === 'video/H264');
  if (h264.length && 'setCodecPreferences' in transceiver) {
    transceiver.setCodecPreferences([...h264, ...codecs.filter((c) => c.mimeType !== 'video/H264')]);
  }
}

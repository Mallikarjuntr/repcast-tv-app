import { openChannel, parseEvent, rtcChannel, type LiveChannel, type RtcSignal } from '@spotter/shared';
import { MediaStream, RTCIceCandidate, RTCPeerConnection, RTCSessionDescription, type MediaStreamTrack } from 'react-native-webrtc';
import { createPoseFeed, type PoseFeed } from './poseFeed';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
/** A dropped connection gets this long to recover by itself before the TV asks for a new offer. */
const RECOVER_MS = 5000;
const RETRY_MS = 1000;
/**
 * How long pose frames are held back to match the picture. The 3rd-gen stick decodes video slowly
 * (~90 ms), so 80 ms suited it; on the Fire TV Stick 4K a recording of a live set showed the skeleton
 * trailing the body by ~200 ms with that hold-back, so poses are now shown as soon as they arrive.
 */
export const POSE_DELAY_MS = 0;

type Candidate = NonNullable<RtcSignal['candidate']>;

export type VideoState = 'waiting' | 'connecting' | 'connected' | 'reconnecting';

export interface VideoSnapshot {
  state: VideoState;
  /** For RTCView; null until the phone's video arrives. */
  streamUrl: string | null;
}

/**
 * Receives the phone's camera over WebRTC, straight across the home Wi-Fi. It listens on the
 * session's rtc sub-channel, answers the phone's offers, and asks for a new offer when it joins
 * or the connection fails. Plain class (no React state) so one link can outlive a screen.
 */
export class VideoReceiver {
  private channel: LiveChannel;
  private pc: RTCPeerConnection | null = null;
  private link = '';
  private pending: Candidate[] = [];
  private retry: ReturnType<typeof setTimeout> | undefined;
  private listeners = new Set<(snapshot: VideoSnapshot) => void>();
  private current: VideoSnapshot = { state: 'waiting', streamUrl: null };
  /** Pose frames from the phone's data channel, every camera frame, timed to match the video. */
  readonly pose: PoseFeed = createPoseFeed();

  constructor(sessionChannel: string) {
    this.channel = openChannel(rtcChannel(sessionChannel), {
      onStatus: (status) => {
        if (status === 'live') this.askForOffer();
      },
      onEvent: (event) => {
        if (event.type === 'rtc' && event.from === 'phone') this.onSignal(event).catch(() => this.askForOffer(RETRY_MS));
      },
    });
  }

  get snapshot(): VideoSnapshot {
    return this.current;
  }

  subscribe(listener: (snapshot: VideoSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** WebRTC stats of the current connection (a Map of reports), for test screens. */
  stats(): Promise<Map<string, any>> | null {
    return this.pc?.getStats() ?? null;
  }

  close(): void {
    clearTimeout(this.retry);
    this.closePeer();
    this.channel.close();
    this.listeners.clear();
  }

  private update(next: Partial<VideoSnapshot>): void {
    this.current = { ...this.current, ...next };
    this.listeners.forEach((listener) => listener(this.current));
  }

  private signal(msg: Omit<RtcSignal, 'type' | 'from' | 'at' | 'link'>): void {
    this.channel.send({ type: 'rtc', from: 'tv', link: this.link, at: Date.now(), ...msg }, true);
  }

  private askForOffer(delay = 0): void {
    clearTimeout(this.retry);
    this.retry = setTimeout(() => this.signal({ want: 'offer' }), delay);
  }

  private closePeer(): void {
    this.pc?.close();
    this.pc = null;
    this.pending = [];
  }

  private async onSignal(event: RtcSignal): Promise<void> {
    if (event.sdp?.type === 'offer') {
      await this.answer(event.link ?? '', event.sdp);
    } else if (event.candidate && event.link === this.link) {
      if (this.pc?.remoteDescription) await this.pc.addIceCandidate(new RTCIceCandidate(event.candidate));
      else this.pending.push(event.candidate);
    }
  }

  private async answer(link: string, offer: NonNullable<RtcSignal['sdp']>): Promise<void> {
    clearTimeout(this.retry);
    this.closePeer();
    this.link = link;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.pc = pc;
    this.update({ state: this.current.streamUrl ? 'reconnecting' : 'connecting' });
    // The library's addEventListener typings don't resolve here, so use the on* handlers.
    pc.ontrack = (event: unknown) => {
      const { streams, track } = event as { streams: MediaStream[]; track: MediaStreamTrack | null };
      // A sender that names no stream still sends a track; wrap it so RTCView can show it.
      const stream = streams[0] ?? (track ? new MediaStream([track]) : null);
      if (stream && pc === this.pc) this.update({ streamUrl: stream.toURL() });
    };
    pc.ondatachannel = (event: unknown) => {
      const channel = (event as { channel: { label: string; onmessage: ((message: unknown) => void) | null } }).channel;
      if (channel.label !== 'pose') return;
      channel.onmessage = (message: unknown) => {
        if (pc !== this.pc) return;
        const pose = parseEvent(String((message as { data: unknown }).data));
        if (pose?.type !== 'pose') return;
        const frame = { p: pose.p, aspect: pose.aspect, mirrored: pose.mirrored };
        if (POSE_DELAY_MS > 0) setTimeout(() => this.pose.push(frame), POSE_DELAY_MS);
        else this.pose.push(frame);
      };
    };
    pc.onicecandidate = (event: unknown) => {
      const c = (event as { candidate: RTCIceCandidate | null }).candidate;
      if (pc === this.pc) this.signal({ candidate: c ? { candidate: c.candidate, sdpMid: c.sdpMid ?? null, sdpMLineIndex: c.sdpMLineIndex ?? null } : null });
    };
    pc.onconnectionstatechange = () => {
      if (pc !== this.pc) return;
      if (pc.connectionState === 'connected') {
        clearTimeout(this.retry);
        this.update({ state: 'connected' });
      } else if (pc.connectionState === 'failed') {
        this.update({ state: 'reconnecting' });
        this.askForOffer(RETRY_MS);
      } else if (pc.connectionState === 'disconnected') {
        this.update({ state: 'reconnecting' });
        this.askForOffer(RECOVER_MS);
      }
    };
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    for (const c of this.pending) await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
    this.pending = [];
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this.signal({ sdp: { type: 'answer', sdp: answer.sdp ?? '' } });
  }
}

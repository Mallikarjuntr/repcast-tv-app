import { createSession, openChannel, type LiveChannel, type LiveStatus, type RtcSignal } from '@spotter/shared';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { RTCIceCandidate, RTCPeerConnection, RTCSessionDescription, RTCView } from 'react-native-webrtc';
import { Kicker } from '../components/Type';
import { colors, fonts, useScale } from '../theme';

/**
 * Phase 0 spike, not part of the product: receives the phone's camera over WebRTC and shows the
 * receive stats needed to judge whether a Fire TV Stick can afford live video. Opened only with
 * `adb shell am start -a android.intent.action.VIEW -d spotter://video-test`.
 */

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
const STATS_MS = 2000;

type Candidate = NonNullable<RtcSignal['candidate']>;

interface Stats {
  fps: number;
  width: number;
  height: number;
  decoded: number;
  dropped: number;
  decoder: string;
  codec: string;
  kbps: number;
  jitterBufferMs: number;
  decodeMs: number;
  rttMs: number;
  route: string;
}

function readStats(report: Map<string, any>, previous: { bytes: number; at: number } | null): { stats: Stats; bytes: number } {
  const all: any[] = [];
  report.forEach((value) => all.push(value));
  const inbound = all.find((r) => r.type === 'inbound-rtp' && (r.kind === 'video' || r.mediaType === 'video')) ?? {};
  const codec = all.find((r) => r.type === 'codec' && r.id === inbound.codecId);
  const pair = all.find((r) => r.type === 'candidate-pair' && (r.nominated || r.selected) && r.state === 'succeeded');
  const local = pair && all.find((r) => r.id === pair.localCandidateId);
  const remote = pair && all.find((r) => r.id === pair.remoteCandidateId);
  const bytes = inbound.bytesReceived ?? 0;
  const seconds = previous ? (Date.now() - previous.at) / 1000 : 0;
  return {
    bytes,
    stats: {
      fps: Math.round(inbound.framesPerSecond ?? 0),
      width: inbound.frameWidth ?? 0,
      height: inbound.frameHeight ?? 0,
      decoded: inbound.framesDecoded ?? 0,
      dropped: inbound.framesDropped ?? 0,
      decoder: inbound.decoderImplementation ?? '?',
      codec: codec?.mimeType ?? '?',
      kbps: previous && seconds > 0 ? Math.round(((bytes - previous.bytes) * 8) / 1000 / seconds) : 0,
      jitterBufferMs: inbound.jitterBufferEmittedCount ? Math.round((inbound.jitterBufferDelay / inbound.jitterBufferEmittedCount) * 1000) : 0,
      decodeMs: inbound.framesDecoded ? Math.round((inbound.totalDecodeTime / inbound.framesDecoded) * 1000) : 0,
      rttMs: pair?.currentRoundTripTime != null ? Math.round(pair.currentRoundTripTime * 1000) : 0,
      route: local && remote ? `${local.candidateType} → ${remote.candidateType} (${remote.protocol ?? ''})` : '?',
    },
  };
}

export function VideoTestScreen() {
  const s = useScale();
  const [code, setCode] = useState<string | null>(null);
  const [live, setLive] = useState<LiveStatus>('connecting');
  const [state, setState] = useState('waiting for an offer');
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const channel = useRef<LiveChannel | null>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const pending = useRef<Candidate[]>([]);

  useEffect(() => {
    let cancelled = false;
    const signal = (msg: Omit<RtcSignal, 'type' | 'from' | 'at'>) =>
      channel.current?.send({ type: 'rtc', from: 'tv', at: Date.now(), ...msg }, true);

    const closePeer = () => {
      pc.current?.close();
      pc.current = null;
      pending.current = [];
      setStreamUrl(null);
    };

    const onOffer = async (sdp: NonNullable<RtcSignal['sdp']>) => {
      closePeer();
      const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pc.current = peer;
      // The library's addEventListener typings don't resolve here, so use the on* handlers.
      peer.ontrack = (event: unknown) => {
        const stream = (event as { streams: { toURL(): string }[] }).streams[0];
        if (stream) setStreamUrl(stream.toURL());
      };
      peer.onicecandidate = (event: unknown) => {
        const c = (event as { candidate: RTCIceCandidate | null }).candidate;
        signal({ candidate: c ? { candidate: c.candidate, sdpMid: c.sdpMid ?? null, sdpMLineIndex: c.sdpMLineIndex ?? null } : null });
      };
      peer.onconnectionstatechange = () => setState(peer.connectionState);
      await peer.setRemoteDescription(new RTCSessionDescription(sdp));
      for (const c of pending.current) await peer.addIceCandidate(new RTCIceCandidate(c));
      pending.current = [];
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      signal({ sdp: { type: 'answer', sdp: answer.sdp ?? '' } });
      setState('answered');
    };

    createSession()
      .then((session) => {
        if (cancelled) return;
        setCode(session.code);
        channel.current = openChannel(session.channel, {
          onStatus: (status) => {
            setLive(status);
            if (status === 'live') signal({ want: 'offer' });
          },
          onEvent: (event) => {
            if (event.type !== 'rtc' || event.from !== 'phone') return;
            if (event.sdp?.type === 'offer') {
              onOffer(event.sdp).catch((err: unknown) => setError(String(err)));
            } else if (event.candidate) {
              if (pc.current?.remoteDescription) pc.current.addIceCandidate(new RTCIceCandidate(event.candidate)).catch(() => {});
              else pending.current.push(event.candidate);
            }
          },
        });
      })
      .catch((err: unknown) => setError(String(err)));

    return () => {
      cancelled = true;
      closePeer();
      channel.current?.close();
    };
  }, []);

  useEffect(() => {
    let previous: { bytes: number; at: number } | null = null;
    const timer = setInterval(() => {
      const peer = pc.current;
      if (!peer) return;
      peer
        .getStats()
        .then((report: Map<string, any>) => {
          const { stats: next, bytes } = readStats(report, previous);
          previous = { bytes, at: Date.now() };
          setStats(next);
          console.log(`[video-test] ${JSON.stringify(next)}`);
        })
        .catch(() => {});
    }, STATS_MS);
    return () => clearInterval(timer);
  }, []);

  const line = (label: string, value: string) => (
    <Text key={label} style={{ fontFamily: fonts.mono, fontSize: s(15), color: colors.ink }}>
      {label.padEnd(10)} {value}
    </Text>
  );

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.paper, padding: s(32), gap: s(32) }}>
      <View style={{ width: s(360), gap: s(10) }}>
        <Kicker>VIDEO TEST · PHASE 0</Kicker>
        <Text style={{ fontFamily: fonts.monoMedium, fontSize: s(56), letterSpacing: s(8), color: colors.ink }}>{code ?? '····'}</Text>
        {line('channel', live)}
        {line('peer', state)}
        {stats ? (
          <>
            {line('frame', `${stats.width}×${stats.height} @ ${stats.fps} fps`)}
            {line('codec', stats.codec)}
            {line('decoder', stats.decoder)}
            {line('bitrate', `${stats.kbps} kbps`)}
            {line('decoded', `${stats.decoded} (dropped ${stats.dropped})`)}
            {line('decode', `${stats.decodeMs} ms/frame`)}
            {line('jitterbuf', `${stats.jitterBufferMs} ms`)}
            {line('rtt', `${stats.rttMs} ms`)}
            {line('route', stats.route)}
          </>
        ) : null}
        {error ? <Text style={{ fontFamily: fonts.sans, fontSize: s(16), color: colors.pen }}>{error}</Text> : null}
      </View>
      <View style={{ flex: 1, backgroundColor: colors.ink }}>
        {streamUrl ? <RTCView streamURL={streamUrl} objectFit="contain" style={{ flex: 1 }} /> : null}
      </View>
    </View>
  );
}

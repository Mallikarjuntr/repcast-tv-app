import { createSession } from '@spotter/shared';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { RTCView } from 'react-native-webrtc';
import { Kicker } from '../components/Type';
import { colors, fonts, useScale } from '../theme';
import { VideoReceiver, type VideoSnapshot } from '../videoReceiver';

/**
 * Test screen, not part of the product: receives the phone's camera through VideoReceiver and
 * shows the receive stats used to judge live video on a Fire TV Stick. Opened only with
 * `adb shell am start -a android.intent.action.VIEW -d spotter://video-test`.
 */

const STATS_MS = 2000;

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
  /** Pose frames received on the data channel so far. */
  poses: number;
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
  const poses = all.find((r) => r.type === 'data-channel' && r.label === 'pose');
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
      poses: poses?.messagesReceived ?? 0,
      route: local && remote ? `${local.candidateType} → ${remote.candidateType} (${remote.protocol ?? ''})` : '?',
    },
  };
}

export function VideoTestScreen() {
  const s = useScale();
  const [code, setCode] = useState<string | null>(null);
  const [video, setVideo] = useState<VideoSnapshot | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const receiver = useRef<VideoReceiver | null>(null);

  useEffect(() => {
    let cancelled = false;
    createSession()
      .then((session) => {
        if (cancelled) return;
        setCode(session.code);
        receiver.current = new VideoReceiver(session.channel);
        receiver.current.subscribe(setVideo);
      })
      .catch((err: unknown) => setError(String(err)));
    return () => {
      cancelled = true;
      receiver.current?.close();
    };
  }, []);

  useEffect(() => {
    let previous: { bytes: number; at: number } | null = null;
    const timer = setInterval(() => {
      receiver.current
        ?.stats()
        ?.then((report) => {
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
    <Text key={label} style={{ fontFamily: fonts.sansMedium, fontSize: s(15), color: colors.text }}>
      {label.padEnd(10)} {value}
    </Text>
  );

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.bg, padding: s(32), gap: s(32) }}>
      <View style={{ width: s(360), gap: s(10) }}>
        <Kicker>VIDEO TEST · PHASE 0</Kicker>
        <Text style={{ fontFamily: fonts.sansBold, fontSize: s(56), letterSpacing: s(8), color: colors.text }}>{code ?? '····'}</Text>
        {line('video', video?.state ?? 'waiting')}
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
            {line('poses', String(stats.poses))}
          </>
        ) : null}
        {error ? <Text style={{ fontFamily: fonts.sans, fontSize: s(16), color: colors.fault }}>{error}</Text> : null}
      </View>
      <View style={{ flex: 1, backgroundColor: colors.text }}>
        {video?.streamUrl ? <RTCView streamURL={video.streamUrl} objectFit="contain" style={{ flex: 1 }} /> : null}
      </View>
    </View>
  );
}

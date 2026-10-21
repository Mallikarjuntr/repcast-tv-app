import { BODY_PARTS, config, type BodyPart, type Session } from '@spotter/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { SetupGuide } from '../components/SetupGuide';
import { BackButton, FocusButton } from '../components/FocusButton';
import { LiveVideo } from '../components/LiveVideo';
import { Cross, Tick } from '../components/Marks';
import { QrCode } from '../components/QrCode';
import { Card, NoVideoNotice, PanelTag, PrivacyLine, Wifi } from '../components/Studio';
import { useVideoMissing } from '../useVideoMissing';
import { Headline, Kicker, Note } from '../components/Type';
import { colors, fonts, useScale } from '../theme';
import { latestOf } from '../poseFeed';
import { useExerciseCommand } from '../useExerciseCommand';
import { usePairing } from '../usePairing';
import { useSpokenGuidance } from '../useSpokenGuidance';
import { useVideoReceiver } from '../useVideoReceiver';
import { say } from '../voice';
import { HINT_LINES, PHONE_LINKED_LINE, READY_LINE, WIFI_LINE } from '../voiceLines';

const NO_NOTES = { depth: false, knees: false, chest: false };

const PART_LABEL: Record<BodyPart, string> = { head: 'Head', hips: 'Hips', knees: 'Knees', feet: 'Feet' };

function StatusRow({ done, children }: { done: boolean; children: string }) {
  const s = useScale();
  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: s(12), borderRadius: s(12), paddingVertical: s(13), paddingHorizontal: s(18) }}>
      <View
        style={{
          width: s(11),
          height: s(11),
          borderRadius: s(6),
          backgroundColor: done ? colors.good : 'transparent',
          borderWidth: done ? 0 : s(2),
          borderColor: colors.faint,
        }}
      />
      <Text style={{ fontFamily: fonts.sansSemi, fontSize: s(18), color: done ? colors.text : colors.muted }}>{children}</Text>
    </Card>
  );
}

/** "1 5 0 4" or, for a 6-digit code, "472 913": easy to read across a room. */
function spacedCode(code: string): string {
  return code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code.split('').join(' ');
}

/** How long the TV counts down before starting by itself, once it can see what the move needs. */
const COUNTDOWN_MS = 5000;
/** Dropping out of view for longer than this cancels the countdown (a stumble doesn't). */
const LOST_GRACE_MS = 1500;

function missingCue(missing: BodyPart[]): string {
  if (missing.includes('head') || missing.includes('hips')) return 'Step into the middle of the frame';
  return `Step back a little — I can't see your ${missing.map((p) => PART_LABEL[p].toLowerCase()).join(' and ')}`;
}

export function PairScreen({
  exercise,
  session,
  onReady,
  onBack,
}: {
  exercise: { id: string; name: string } | null;
  /** The pairing from the move before: the phone is still linked, so no new code. */
  session?: Session | null;
  onReady: (session: Session) => void;
  onBack: () => void;
}) {
  const s = useScale();
  const { state, newCode, pose } = usePairing(session);
  const [panel, setPanel] = useState({ width: 0, height: 0 });
  const [startsAt, setStartsAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const lostSince = useRef<number | null>(null);
  const started = useRef(false);

  const ready = state.phase === 'ready' ? state : null;
  const video = useVideoReceiver(ready?.session.channel ?? null);
  // Once the phone's picture arrives, the floor plan gives way to the user seeing themselves.
  const showVideo = video.state === 'connected' && video.streamUrl !== null && panel.width > 0;
  const videoPose = useMemo(() => latestOf(video.pose, pose), [video.pose, pose]);
  const missing = ready?.framing ? BODY_PARTS.filter((p) => !ready.framing![p]) : null;
  // The phone knows what this exercise needs (squats don't need feet); older phones only send the checklist.
  const allVisible = ready?.framingReady ?? (missing !== null && missing.length === 0);
  const hint = ready?.phoneConnected ? ready.hint : null;
  const phoneConnected = ready?.phoneConnected ?? false;
  const videoMissing = useVideoMissing(showVideo, phoneConnected, 8000);

  // Said once per pairing: not again when the next move reuses the link.
  const linkedBefore = useRef(!!session);
  useEffect(() => {
    if (linkedBefore.current) return;
    const timer = setTimeout(() => say(WIFI_LINE), 800);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (phoneConnected && !linkedBefore.current) say(PHONE_LINKED_LINE);
  }, [phoneConnected]);

  // Starts by itself: once the camera is on and can see what the first move needs, a short countdown
  // runs (the phone shows it too); "Start now" skips it, and stepping out of view for a moment stops it.
  const canStart = phoneConnected && ready?.framing != null && allVisible && !hint;
  const start = useCallback(() => {
    if (started.current || !ready) return;
    started.current = true;
    onReady(ready.session);
  }, [onReady, ready]);
  useEffect(() => {
    if (canStart) {
      lostSince.current = null;
      // The clock only ticks while counting down, so bring it up to date as the countdown starts.
      setNow(Date.now());
      setStartsAt((t) => t ?? Date.now() + COUNTDOWN_MS);
    } else if (startsAt !== null) {
      lostSince.current ??= Date.now();
    }
  }, [canStart, startsAt]);
  useEffect(() => {
    if (startsAt === null) return;
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (lostSince.current !== null && t - lostSince.current > LOST_GRACE_MS) {
        lostSince.current = null;
        setStartsAt(null);
      } else if (t >= startsAt) {
        start();
      }
    }, 250);
    return () => clearInterval(timer);
  }, [startsAt, start]);
  const secondsLeft = startsAt === null ? null : Math.max(1, Math.ceil((startsAt - now) / 1000));
  useExerciseCommand(ready?.session.channel ?? null, {
    id: exercise?.id ?? null,
    name: exercise?.name,
    phase: secondsLeft === null ? 'pair' : 'countdown',
    secondsLeft: secondsLeft ?? undefined,
  });
  // Spoken help to get into frame, then a go-ahead once the coach can see what it needs.
  useSpokenGuidance(hint ? HINT_LINES[hint] : allVisible && ready?.framing ? READY_LINE : null, phoneConnected, hint !== null);

  const guidance =
    ready?.phoneConnected && missing
      ? hint
        ? HINT_LINES[hint].replace(/\.$/, '')
        : !allVisible
          ? missingCue(missing)
          : ready.sideOn
            ? 'Turn the phone about 45° — from the side I can’t see both legs'
            : 'I can see you — ready when you are'
      : ready?.phoneConnected
        ? 'Waiting for the camera to start…'
        : 'Then step into view of the phone';

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.bg, paddingTop: s(40), paddingHorizontal: s(64), paddingBottom: s(36), gap: s(40) }}>
      <View style={{ width: s(440), gap: s(16) }}>
        <Kicker color={colors.accent}>STEP 1 OF 2 · PAIR</Kicker>
        <Headline text={'Scan with\nyour phone'} size={66} />
        <Note size={18}>Scan this with your phone. It opens in the browser, so there's nothing to install.</Note>
        {/* The live picture goes straight from phone to TV over the home network, so this matters. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10), backgroundColor: colors.surface, borderRadius: s(10), paddingVertical: s(9), paddingHorizontal: s(14), alignSelf: 'flex-start' }}>
          <Wifi size={s(22)} />
          <Text style={{ fontFamily: fonts.sansBold, fontSize: s(17), color: colors.text }}>Phone and TV on the same Wi-Fi</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(22), minHeight: s(190) }}>
          {state.phase === 'ready' ? (
            <>
              {/* The code draws its own light quiet zone; the rounded clip just softens the corners. */}
              <View style={{ borderRadius: s(12), overflow: 'hidden' }}>
                <QrCode value={`${config.pairUrl}?code=${state.session.code}`} size={s(188)} />
              </View>
              <View style={{ gap: s(6), flexShrink: 1 }}>
                <Kicker size={13}>OR TYPE THIS CODE</Kicker>
                <Headline text={spacedCode(state.session.code)} size={state.session.code.length > 4 ? 52 : 62} />
                <Text style={{ fontFamily: fonts.sans, fontSize: s(13), lineHeight: s(18), color: colors.faint }}>
                  {'at ' + config.pairUrl.replace('https://', '').replace(/\/$/, '').replace('/', '\n/')}
                </Text>
              </View>
            </>
          ) : state.phase === 'loading' ? (
            <Note size={20}>Getting a code from RepCast…</Note>
          ) : (
            <View style={{ gap: s(10) }}>
              <Note size={20} color={colors.text}>
                {"I couldn't reach RepCast. Check the TV's internet."}
              </Note>
              <Kicker size={12}>{state.message.toUpperCase()}</Kicker>
            </View>
          )}
        </View>

        <View style={{ gap: s(12), marginTop: 'auto' }}>
          <StatusRow done={phoneConnected}>{phoneConnected ? 'Phone connected' : 'Waiting for your phone…'}</StatusRow>
          <View style={{ flexDirection: 'row', marginLeft: -s(6) }}>
            {state.phase === 'error' ? (
              <FocusButton label="Try again" onPress={newCode} preferredFocus />
            ) : (
              <FocusButton label="New code" onPress={newCode} variant="quiet" size="compact" preferredFocus={!phoneConnected} />
            )}
          </View>
          <PrivacyLine size={13} />
        </View>
      </View>

      <View style={{ flex: 1, gap: s(14) }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Kicker>{showVideo ? 'STEP 2 OF 2 · YOU, RIGHT NOW' : 'STEP 2 OF 2 · SET IT DOWN'}</Kicker>
          <BackButton onPress={onBack} />
        </View>
        <View
          style={{ flex: 1, backgroundColor: colors.surface, borderRadius: s(20), overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}
          onLayout={(e) => setPanel({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
        >
          {showVideo ? (
            <LiveVideo streamUrl={video.streamUrl!} getPose={videoPose.getPose} subscribePose={videoPose.subscribePose} notes={NO_NOTES} width={panel.width} height={panel.height} />
          ) : (
            <SetupGuide width={panel.width} height={panel.height} />
          )}
          {showVideo ? (
            <View style={{ position: 'absolute', left: s(18), top: s(16) }}>
              <PanelTag dot={colors.live}>YOU · LIVE</PanelTag>
            </View>
          ) : videoMissing ? (
            <View style={{ position: 'absolute', left: s(16), bottom: s(16), maxWidth: panel.width * 0.62 }}>
              <NoVideoNotice compact />
            </View>
          ) : null}
          {ready?.phoneConnected && missing ? (
            <View style={{ position: 'absolute', right: s(16), top: s(16), gap: s(8) }}>
              {BODY_PARTS.map((part) => {
                const seen = ready.framing![part];
                return (
                  <View key={part} style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), backgroundColor: colors.bg, borderRadius: s(8), paddingVertical: s(5), paddingLeft: s(8), paddingRight: s(14) }}>
                    {seen ? <Tick size={s(20)} /> : <Cross size={s(20)} color={allVisible ? colors.faint : colors.fault} />}
                    {/* A part the exercise can do without (e.g. feet for squats) isn't marked as a problem. */}
                    <Text style={{ fontFamily: fonts.sansBold, fontSize: s(15), color: seen ? colors.text : allVisible ? colors.faint : colors.fault }}>{PART_LABEL[part]}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: s(20), minHeight: s(66) }}>
          {secondsLeft !== null ? (
            <Text style={{ flexShrink: 1, fontFamily: fonts.display, fontSize: s(34), color: colors.accent }}>
              {`Starting in ${secondsLeft}…`}
              <Text style={{ fontFamily: fonts.displaySemi, fontSize: s(24), color: colors.textSoft }}>{exercise ? `  ${exercise.name}` : ''}</Text>
            </Text>
          ) : (
            <Text style={{ flexShrink: 1, fontFamily: fonts.displaySemi, fontSize: s(26), color: allVisible && !hint ? colors.text : colors.textSoft }}>{guidance}</Text>
          )}
          {secondsLeft !== null ? (
            <FocusButton label="Start now" onPress={start} play preferredFocus />
          ) : ready?.phoneConnected ? (
            <FocusButton label={allVisible ? 'Start workout' : 'Start anyway'} onPress={start} variant={allVisible ? 'primary' : 'secondary'} play={allVisible} preferredFocus={allVisible} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

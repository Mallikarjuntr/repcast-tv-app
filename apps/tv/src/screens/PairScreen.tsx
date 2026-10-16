import { BODY_PARTS, config, type BodyPart } from '@spotter/shared';
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { FloorPlan } from '../components/FloorPlan';
import { FocusButton } from '../components/FocusButton';
import { LiveVideo } from '../components/LiveVideo';
import { Cross, Tick } from '../components/Marks';
import { QrCode } from '../components/QrCode';
import { Card, PanelTag, PrivacyLine } from '../components/Studio';
import { Headline, Kicker, Note } from '../components/Type';
import { colors, fonts, useScale } from '../theme';
import { latestOf } from '../poseFeed';
import { usePairing } from '../usePairing';
import { useSpokenGuidance } from '../useSpokenGuidance';
import { useVideoReceiver } from '../useVideoReceiver';
import { say } from '../voice';
import { HINT_LINES, PHONE_LINKED_LINE, READY_LINE } from '../voiceLines';

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

function missingCue(missing: BodyPart[]): string {
  if (missing.includes('head') || missing.includes('hips')) return 'Step into the middle of the frame';
  return `Step back a little — I can't see your ${missing.map((p) => PART_LABEL[p].toLowerCase()).join(' and ')}`;
}

export function PairScreen({ onReady }: { onReady: (channel: string) => void }) {
  const s = useScale();
  const { state, newCode, pose } = usePairing();
  const [panel, setPanel] = useState({ width: 0, height: 0 });

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

  useEffect(() => {
    if (phoneConnected) say(PHONE_LINKED_LINE);
  }, [phoneConnected]);
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
        <Headline text={'Your phone is\nthe camera'} size={66} />
        <Note size={18}>Scan this with your phone. It opens in the browser, so there's nothing to install.</Note>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(22), minHeight: s(190) }}>
          {state.phase === 'ready' ? (
            <>
              {/* The code draws its own light quiet zone; the rounded clip just softens the corners. */}
              <View style={{ borderRadius: s(12), overflow: 'hidden' }}>
                <QrCode value={`${config.cameraAppUrl}?code=${state.session.code}`} size={s(188)} />
              </View>
              <View style={{ gap: s(6), flexShrink: 1 }}>
                <Kicker size={13}>OR TYPE THIS CODE</Kicker>
                <Headline text={spacedCode(state.session.code)} size={state.session.code.length > 4 ? 52 : 62} />
                <Text style={{ fontFamily: fonts.sans, fontSize: s(13), lineHeight: s(18), color: colors.faint }}>
                  {'at ' + config.cameraAppUrl.replace('https://', '').replace(/\/$/, '').replace('/', '\n/')}
                </Text>
              </View>
            </>
          ) : state.phase === 'loading' ? (
            <Note size={20}>Getting a code from Spotter…</Note>
          ) : (
            <View style={{ gap: s(10) }}>
              <Note size={20} color={colors.text}>
                {"I couldn't reach Spotter. Check the TV's internet."}
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
        <Kicker>{showVideo ? 'STEP 2 OF 2 · YOU, RIGHT NOW' : 'STEP 2 OF 2 · SET IT DOWN'}</Kicker>
        <View
          style={{ flex: 1, backgroundColor: colors.surface, borderRadius: s(20), overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}
          onLayout={(e) => setPanel({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
        >
          {showVideo ? (
            <LiveVideo streamUrl={video.streamUrl!} getPose={videoPose.getPose} subscribePose={videoPose.subscribePose} notes={NO_NOTES} width={panel.width} height={panel.height} />
          ) : (
            <FloorPlan width={s(560)} height={s(453)} />
          )}
          {showVideo ? (
            <View style={{ position: 'absolute', left: s(18), top: s(16) }}>
              <PanelTag dot={colors.live}>YOU · LIVE</PanelTag>
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
          <Text style={{ flexShrink: 1, fontFamily: fonts.displaySemi, fontSize: s(26), color: allVisible && !hint ? colors.text : colors.textSoft }}>{guidance}</Text>
          {ready?.phoneConnected ? (
            <FocusButton label={allVisible ? 'Start workout' : 'Start anyway'} onPress={() => onReady(ready.session.channel)} variant={allVisible ? 'primary' : 'secondary'} play={allVisible} preferredFocus={allVisible} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

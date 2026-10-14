import { BODY_PARTS, config, type BodyPart } from '@spotter/shared';
import { Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { FloorPlan } from '../components/FloorPlan';
import { FocusButton } from '../components/FocusButton';
import { Tick } from '../components/Marks';
import { QrCode } from '../components/QrCode';
import { Headline, Kicker, PenNote } from '../components/Type';
import { colors, fonts, useScale } from '../theme';
import { usePairing } from '../usePairing';

const PART_LABEL: Record<BodyPart, string> = { head: 'Head', hips: 'Hips', knees: 'Knees', feet: 'Feet' };

function Waiting({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 34 34">
      <Circle cx={17} cy={17} r={9} fill="none" stroke={colors.pencil} strokeWidth={2.5} strokeDasharray="4 4" />
    </Svg>
  );
}

function Cross({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 34 34">
      <Path d="M9 9 L 25 25 M25 9 L 9 25" fill="none" stroke={colors.pen} strokeWidth={3.5} strokeLinecap="round" />
    </Svg>
  );
}

function StatusRow({ done, children }: { done: boolean; children: string }) {
  const s = useScale();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(12) }}>
      {done ? <Tick size={s(26)} /> : <Waiting size={s(26)} />}
      <Text style={{ fontFamily: fonts.sans, fontSize: s(20), color: done ? colors.ink : colors.pencil }}>{children}</Text>
    </View>
  );
}

function missingCue(missing: BodyPart[]): string {
  if (missing.includes('head') || missing.includes('hips')) return 'step into the middle of the frame';
  return `step back a little — I can't see your ${missing.map((p) => PART_LABEL[p].toLowerCase()).join(' and ')}`;
}

export function PairScreen({ onReady }: { onReady: (channel: string) => void }) {
  const s = useScale();
  const { state, newCode } = usePairing();

  const ready = state.phase === 'ready' ? state : null;
  const missing = ready?.framing ? BODY_PARTS.filter((p) => !ready.framing![p]) : null;
  const allVisible = missing !== null && missing.length === 0;

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.paper, paddingTop: s(40), paddingHorizontal: s(64), paddingBottom: s(36), gap: s(64) }}>
      <View style={{ flex: 0.9, gap: s(18) }}>
        <Kicker>STEP 1 OF 2 · PAIR</Kicker>
        <Headline lead={'Your phone is\nthe '} italic="camera." size={64} />
        <Text style={{ fontFamily: fonts.sans, fontSize: s(21), lineHeight: s(30), color: colors.inkSoft, maxWidth: s(440) }}>
          Scan this with your phone. It opens in the browser, so there's nothing to install.
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(28), minHeight: s(180) }}>
          {state.phase === 'ready' ? (
            <>
              <View style={{ borderWidth: s(2), borderColor: colors.ink, padding: s(6), backgroundColor: colors.paperBright }}>
                <QrCode value={`${config.cameraAppUrl}?code=${state.session.code}`} size={s(164)} />
              </View>
              <View style={{ gap: s(4), flexShrink: 1 }}>
                <Kicker size={15}>OR TYPE THIS CODE</Kicker>
                <Text style={{ fontFamily: fonts.monoMedium, fontSize: s(56), letterSpacing: s(10), color: colors.ink }}>{state.session.code}</Text>
                <Kicker size={13}>{'AT ' + config.cameraAppUrl.replace('https://', '').replace(/\/$/, '').replace('/', '\n/')}</Kicker>
              </View>
            </>
          ) : state.phase === 'loading' ? (
            <PenNote arrow={false}>getting a code from Spotter…</PenNote>
          ) : (
            <View style={{ gap: s(12) }}>
              <PenNote arrow={false}>{"I couldn't reach Spotter. Check the TV's internet."}</PenNote>
              <Kicker size={13}>{state.message.toUpperCase()}</Kicker>
            </View>
          )}
        </View>

        <View style={{ gap: s(10), marginTop: 'auto' }}>
          <StatusRow done={ready?.phoneConnected ?? false}>{ready?.phoneConnected ? 'Phone connected' : 'Waiting for your phone…'}</StatusRow>
          {ready?.phoneConnected && missing ? (
            <>
              <View style={{ flexDirection: 'row', gap: s(18), paddingLeft: s(4) }}>
                {BODY_PARTS.map((part) => (
                  <View key={part} style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
                    {ready.framing![part] ? <Tick size={s(22)} /> : <Cross size={s(22)} />}
                    <Text style={{ fontFamily: fonts.sans, fontSize: s(18), color: ready.framing![part] ? colors.ink : colors.pen }}>{PART_LABEL[part]}</Text>
                  </View>
                ))}
              </View>
              <PenNote arrow={false} size={24} tilt={-1.5}>
                {!allVisible ? missingCue(missing) : ready.sideOn ? 'turn the phone about 45° — from the side I can’t see both legs' : 'I can see all of you — ready when you are'}
              </PenNote>
            </>
          ) : (
            <StatusRow done={false}>{ready?.phoneConnected ? 'Waiting for the camera to start…' : 'Then step into view of the phone'}</StatusRow>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(24), marginTop: s(6) }}>
            {state.phase === 'error' ? (
              <FocusButton label="Try again" onPress={newCode} preferredFocus fontSize={20} />
            ) : (
              <>
                {ready?.phoneConnected ? (
                  <FocusButton label={allVisible ? 'Start workout' : 'Start anyway'} onPress={() => onReady(ready.session.channel)} preferredFocus={allVisible} fontSize={20} />
                ) : null}
                <FocusButton label="New code" onPress={newCode} variant="link" fontSize={18} preferredFocus={!ready?.phoneConnected} />
              </>
            )}
          </View>
        </View>
      </View>

      <View style={{ flex: 1.25, gap: s(18) }}>
        <Kicker>STEP 2 OF 2 · SET IT DOWN</Kicker>
        <View style={{ flex: 1, backgroundColor: colors.paperDeep, borderWidth: s(1.5), borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
          <FloorPlan width={s(640)} height={s(518)} />
        </View>
      </View>
    </View>
  );
}

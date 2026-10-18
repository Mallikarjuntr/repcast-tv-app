import type { AnalysisReport, AnalysisRequest } from '@spotter/shared';
import { useMemo } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useAnalysis } from '../analysis';
import { BackButton, FocusButton } from '../components/FocusButton';
import { Card, CoachCard } from '../components/Studio';
import { Headline, Kicker, Note } from '../components/Type';
import { colors, fonts, useScale } from '../theme';

function Section({ label, children, style }: { label: string; children: React.ReactNode; style?: object }) {
  const s = useScale();
  return (
    <Card style={{ gap: s(8), ...style }}>
      <Kicker size={12} color={colors.accent}>
        {label}
      </Kicker>
      {children}
    </Card>
  );
}

function Body({ children, lines = 4, strong = false }: { children: string; lines?: number; strong?: boolean }) {
  const s = useScale();
  return (
    <Text style={{ fontFamily: strong ? fonts.sansSemi : fonts.sans, fontSize: s(18), lineHeight: s(25), color: strong ? colors.text : colors.textSoft }} numberOfLines={lines}>
      {children}
    </Text>
  );
}

function Report({ report }: { report: AnalysisReport }) {
  const s = useScale();
  const numbers = report.numbers.slice(0, 4);
  return (
    <View style={{ flex: 1, flexDirection: 'row', gap: s(20) }}>
      <View style={{ width: s(470), gap: s(14) }}>
        <CoachCard line={report.coachNote} label="YOUR AI COACH" size={21} />
        <Section label="HOW IT WENT" style={{ flex: 1 }}>
          <Body lines={5}>{report.howItWent}</Body>
        </Section>
      </View>
      <View style={{ flex: 1, gap: s(14) }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(12) }}>
          {numbers.map((n, i) => (
            // Two per row; each cell has the same border so Yoga gives them equal widths.
            <Card key={i} style={{ width: numbers.length === 1 ? '100%' : '48.8%', gap: s(4), paddingVertical: s(14) }}>
              <Text style={{ fontFamily: fonts.display, fontSize: s(22), color: colors.text }} numberOfLines={1}>
                {n.title}
              </Text>
              <Body lines={3}>{n.detail}</Body>
            </Card>
          ))}
        </View>
        <View style={{ flex: 1, flexDirection: 'row', gap: s(12) }}>
          <Section label="COMPARED WITH LAST TIME" style={{ flex: 1 }}>
            <Body lines={5}>{report.comparedWithLastTime}</Body>
          </Section>
          <Section label="NEXT SESSION" style={{ flex: 1 }}>
            <Body strong lines={3}>
              {report.nextSession.plan}
            </Body>
            <Body lines={3}>{report.nextSession.drill}</Body>
          </Section>
        </View>
      </View>
    </View>
  );
}

/**
 * "Analyse with AI": the AI coach's report on one camera workout, written by Claude on Amazon
 * Bedrock from the rep numbers alone.
 */
export function AnalysisScreen({
  request,
  cached,
  onReport,
  onBack,
}: {
  request: AnalysisRequest;
  cached: AnalysisReport | undefined;
  onReport: (report: AnalysisReport) => void;
  onBack: () => void;
}) {
  const s = useScale();
  const { state, retry } = useAnalysis(request, cached, onReport);
  const attempts = request.attempts.length;
  const kicker = useMemo(() => `AI COACH · ${request.move.name.toUpperCase()} · ${attempts} ${attempts === 1 ? 'ATTEMPT' : 'ATTEMPTS'}`, [request.move.name, attempts]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: s(36), paddingHorizontal: s(64), paddingBottom: s(28), gap: s(18) }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: s(24) }}>
        <View style={{ flex: 1, gap: s(10) }}>
          <Kicker color={colors.accent}>{kicker}</Kicker>
          <Headline
            text={state.phase === 'done' ? state.report.headline : state.phase === 'writing' ? 'Reading your numbers…' : "Couldn't write the report"}
            size={state.phase === 'done' ? 56 : 64}
          />
        </View>
        <BackButton onPress={onBack} preferredFocus={state.phase !== 'failed'} />
      </View>

      {state.phase === 'done' ? (
        <Report report={state.report} />
      ) : state.phase === 'writing' ? (
        <View style={{ flex: 1, gap: s(22), justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.accent} style={{ alignSelf: 'flex-start' }} />
          <View style={{ maxWidth: s(760) }}>
            <Note size={22}>
              Claude on Amazon Bedrock is looking at your {attempts} {attempts === 1 ? 'attempt' : 'attempts'}: how deep, how fast, and what the camera spotted. This takes a few seconds.
            </Note>
          </View>
        </View>
      ) : (
        <View style={{ flex: 1, gap: s(22), justifyContent: 'center' }}>
          <View style={{ maxWidth: s(760) }}>
            <Note size={22}>{state.message}</Note>
          </View>
          <View style={{ flexDirection: 'row', gap: s(10), marginLeft: -s(6) }}>
            <FocusButton label="Try again" onPress={retry} preferredFocus />
            <FocusButton label="Back to results" onPress={onBack} variant="secondary" />
          </View>
        </View>
      )}

      <Text style={{ fontFamily: fonts.sans, fontSize: s(14), color: colors.faint }}>
        Written by AI (Claude on Amazon Bedrock) from your rep numbers only — no video or pictures were sent. Not medical advice.
      </Text>
    </View>
  );
}

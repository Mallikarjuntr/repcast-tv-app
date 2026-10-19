import type { AnalysisReport, AnalysisRequest } from '@spotter/shared';
import { useMemo } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useAnalysis } from '../analysis';
import { BackButton, FocusButton } from '../components/FocusButton';
import { Card } from '../components/Studio';
import { Headline, Kicker } from '../components/Type';
import { buildDashboard, dashboardHeadline, type AttemptBar, type Dashboard } from '../dashboard';
import { colors, fonts, useScale } from '../theme';

/** Same colours as the receipt: clean in the accent, a note in grey, a no rep outlined in red. */
function barStyle(verdict: AttemptBar['verdict'], counted: boolean) {
  if (!counted) return { backgroundColor: 'transparent', borderColor: colors.fault, borderWidth: 2 };
  return { backgroundColor: verdict === 'good' ? colors.accent : colors.faint, borderWidth: 0 };
}

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  return `${m}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
}

function Delta({ value, unit = '' }: { value: number; unit?: string }) {
  const s = useScale();
  const up = value > 0;
  const colour = value === 0 ? colors.faint : up ? colors.good : colors.fault;
  return (
    <Text style={{ fontFamily: fonts.sansBold, fontSize: s(13), color: colour }}>
      {value === 0 ? '= same as last time' : `${up ? '▲' : '▼'} ${Math.abs(value)}${unit} vs last time`}
    </Text>
  );
}

function Tile({ value, label, color = colors.text, children }: { value: string; label: string; color?: string; children?: React.ReactNode }) {
  const s = useScale();
  return (
    <Card style={{ flex: 1, paddingVertical: s(14), paddingHorizontal: s(18), gap: s(6) }}>
      <Headline text={value} size={40} color={color} />
      <Kicker size={12}>{label}</Kicker>
      {children}
    </Card>
  );
}

/** One bar per attempt, grouped by set; taller = more range (the deepest rep fills the chart). */
function EveryRep({ d }: { d: Dashboard }) {
  const s = useScale();
  const showDegrees = d.bars.length <= 30 && d.bars.some((b) => b.bottom !== null);
  return (
    <Card style={{ flex: 1.15, gap: s(10) }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Kicker size={12} color={colors.accent}>
          EVERY ATTEMPT · TALLER = DEEPER
        </Kicker>
        <View style={{ flexDirection: 'row', gap: s(16) }}>
          {(
            [
              ['Clean', 'good', true],
              ['With a note', 'fix', true],
              ['No rep', 'no-rep', false],
            ] as const
          ).map(([label, verdict, counted]) => (
            <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
              <View style={{ width: s(12), height: s(12), borderRadius: s(3), ...barStyle(verdict, counted) }} />
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: s(13), color: colors.muted }}>{label}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: s(18) }}>
        {d.sets.map((set) => {
          const bars = d.bars.filter((b) => b.set === set.set);
          return (
            <View key={set.set} style={{ flex: Math.max(1, bars.length), height: '100%', gap: s(8) }}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: s(bars.length > 14 ? 3 : 6), borderBottomWidth: s(1), borderColor: colors.line }}>
                {bars.map((b, i) => (
                  <View key={i} style={{ flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center', gap: s(3) }}>
                    {showDegrees && b.bottom !== null ? (
                      <Text style={{ fontFamily: fonts.sansMedium, fontSize: s(10), color: colors.faint }} numberOfLines={1}>
                        {Math.round(b.bottom)}°
                      </Text>
                    ) : null}
                    <View style={{ width: '100%', height: `${Math.round(b.range * 82)}%`, borderTopLeftRadius: s(4), borderTopRightRadius: s(4), ...barStyle(b.verdict, b.counted) }} />
                  </View>
                ))}
              </View>
              <Text style={{ fontFamily: fonts.sansSemi, fontSize: s(13), color: colors.muted }} numberOfLines={1}>
                SET {set.set + 1} · {set.counted}/{set.attempts} counted
              </Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

/** Clean / note / no rep as one stacked bar, then what the camera flagged most. */
function FormBreakdown({ d }: { d: Dashboard }) {
  const s = useScale();
  const parts = [
    { n: d.clean, label: 'clean', style: barStyle('good', true) },
    { n: d.withNote, label: 'with a note', style: barStyle('fix', true) },
    { n: d.noReps, label: 'no rep', style: barStyle('no-rep', false) },
  ].filter((p) => p.n > 0);
  return (
    <Card style={{ flex: 1, gap: s(9), paddingVertical: s(16) }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Kicker size={12} color={colors.accent}>
          FORM
        </Kicker>
        <Text style={{ fontFamily: fonts.sansMedium, fontSize: s(13), color: colors.textSoft }}>{parts.map((p) => `${p.n} ${p.label}`).join(' · ')}</Text>
      </View>
      <View style={{ flexDirection: 'row', height: s(20), gap: s(4) }}>
        {parts.map((p) => (
          <View key={p.label} style={{ flex: p.n, borderRadius: s(5), ...p.style }} />
        ))}
      </View>
      <Kicker size={11}>WHAT THE CAMERA SPOTTED</Kicker>
      {d.reasons.length === 0 ? (
        <Text style={{ fontFamily: fonts.sans, fontSize: s(14), color: colors.muted }}>Nothing to fix — every rep was clean.</Text>
      ) : (
        d.reasons.slice(0, 2).map((r) => (
          <View key={r.text} style={{ flexDirection: 'row', alignItems: 'center', gap: s(10) }}>
            <View style={{ minWidth: s(34), alignItems: 'center', borderRadius: s(6), backgroundColor: colors.fault, paddingVertical: s(2) }}>
              <Text style={{ fontFamily: fonts.sansBold, fontSize: s(13), color: colors.onAccent }}>×{r.count}</Text>
            </View>
            <Text style={{ flex: 1, fontFamily: fonts.sans, fontSize: s(14), color: colors.textSoft }} numberOfLines={1}>
              {r.text}
            </Text>
          </View>
        ))
      )}
    </Card>
  );
}

/** This move over time: one column per session, clean reps in the accent. */
function Trend({ d }: { d: Dashboard }) {
  const s = useScale();
  const most = Math.max(1, ...d.trend.map((t) => t.reps));
  return (
    <Card style={{ flex: 1, gap: s(10) }}>
      <Kicker size={12} color={colors.accent}>
        {d.trend.length > 1 ? 'YOU VS EARLIER SESSIONS' : 'FIRST TIME ON RECORD'}
      </Kicker>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: s(10) }}>
        {d.trend.map((t, i) => {
          const clean = t.clean === null ? null : Math.min(t.clean, t.reps);
          return (
            <View key={i} style={{ flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center', gap: s(4) }}>
              <Text style={{ fontFamily: fonts.displaySemi, fontSize: s(16), color: t.today ? colors.text : colors.muted }}>{t.reps}</Text>
              <View
                style={{
                  width: '72%',
                  height: `${Math.max(4, Math.round((t.reps / most) * 52))}%`,
                  borderRadius: s(5),
                  overflow: 'hidden',
                  justifyContent: 'flex-end',
                  backgroundColor: colors.raised,
                  borderWidth: t.today ? s(2) : 0,
                  borderColor: colors.text,
                }}
              >
                {clean !== null && t.reps > 0 ? <View style={{ height: `${Math.round((clean / t.reps) * 100)}%`, backgroundColor: colors.accent }} /> : null}
              </View>
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: s(11), color: t.today ? colors.text : colors.faint }} numberOfLines={1}>
                {t.label}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={{ fontFamily: fonts.sans, fontSize: s(12), color: colors.faint }}>Reps counted; orange = clean</Text>
    </Card>
  );
}

/** "Last time: 24 reps, 88% clean. Today: 12, 83% clean." Stated from the numbers, never by the model. */
function comparison(d: Dashboard, req: AnalysisRequest): string {
  const last = req.previous[0];
  if (!last) return 'Your first time on camera with this move: this sets the bar.';
  const when = last.daysAgo === 0 ? 'Earlier today' : last.daysAgo === 1 ? 'Yesterday' : `${last.daysAgo} days ago`;
  const lastPct = last.cleanReps !== undefined && last.reps > 0 ? `, ${Math.round((last.cleanReps / last.reps) * 100)}% clean` : '';
  const nowPct = d.cleanPct !== null ? `, ${d.cleanPct}% clean` : '';
  return `${when}: ${last.reps} reps${lastPct}. Now: ${d.counted}${nowPct}.`;
}

function AiCoach({ state, retry, left, compared }: { state: ReturnType<typeof useAnalysis>['state']; retry: () => void; left: AnalysisReport['left']; compared: string }) {
  const s = useScale();
  const by = state.phase === 'done' && state.report.writtenBy ? state.report.writtenBy : 'Amazon Nova';
  return (
    <Card style={{ width: s(340), gap: s(12) }}>
      <Kicker size={12} color={colors.accent}>
        AI COACH · {by.toUpperCase()}
      </Kicker>
      {state.phase === 'writing' ? (
        <View style={{ flex: 1, justifyContent: 'center', gap: s(16) }}>
          <ActivityIndicator size="large" color={colors.accent} style={{ alignSelf: 'flex-start' }} />
          <Text style={{ fontFamily: fonts.sans, fontSize: s(16), lineHeight: s(23), color: colors.textSoft }}>
            Reading these numbers and writing your coach's note. The charts are already yours — this takes a few seconds.
          </Text>
        </View>
      ) : state.phase === 'failed' ? (
        <View style={{ flex: 1, justifyContent: 'center', gap: s(16) }}>
          <Text style={{ fontFamily: fonts.sans, fontSize: s(16), lineHeight: s(23), color: colors.textSoft }}>{state.message}</Text>
          <View style={{ flexDirection: 'row', marginLeft: -s(6) }}>
            <FocusButton label="Try again" onPress={retry} preferredFocus size="compact" />
          </View>
        </View>
      ) : (
        <View style={{ flex: 1, gap: s(12) }}>
          {/* Only the coaching is the model's: the headline and the comparison come from the numbers. */}
          <Text style={{ fontFamily: fonts.sansBold, fontSize: s(19), lineHeight: s(26), color: colors.text }} numberOfLines={6}>
            “{state.report.coachNote}”
          </Text>
          <Text style={{ fontFamily: fonts.sans, fontSize: s(14), lineHeight: s(20), color: colors.textSoft }} numberOfLines={3}>
            {compared}
          </Text>
          <View style={{ marginTop: 'auto', gap: s(6), backgroundColor: colors.raised, borderRadius: s(12), padding: s(14) }}>
            <Kicker size={11} color={colors.accent}>
              NEXT SESSION
            </Kicker>
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: s(15), lineHeight: s(21), color: colors.text }} numberOfLines={2}>
              {state.report.nextSession.plan}
            </Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: s(14), lineHeight: s(20), color: colors.textSoft }} numberOfLines={3}>
              {state.report.nextSession.drill}
            </Text>
          </View>
        </View>
      )}
      {left ? (
        <Text style={{ fontFamily: fonts.sans, fontSize: s(12), color: colors.faint }}>
          {left.move} more AI {left.move === 1 ? 'note' : 'notes'} for this move this session
        </Text>
      ) : null}
    </Card>
  );
}

/**
 * The workout analysis: charts worked out on the TV from the rep numbers (instant, free, and the
 * same every time), with the AI coach's note from Amazon Bedrock alongside.
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
  const d = useMemo(() => buildDashboard(request), [request]);
  const left = state.phase === 'done' ? state.report.left : cached?.left;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: s(28), paddingHorizontal: s(56), paddingBottom: s(20), gap: s(14) }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: s(24) }}>
        <View style={{ flex: 1, gap: s(8) }}>
          <Kicker color={colors.accent}>
            WORKOUT ANALYSIS · {request.move.name.toUpperCase()} · {request.plan.sets} × {request.plan.reps}
          </Kicker>
          <Headline text={dashboardHeadline(d)} size={46} />
        </View>
        <BackButton onPress={onBack} preferredFocus={state.phase !== 'failed'} />
      </View>

      <View style={{ flexDirection: 'row', gap: s(12) }}>
        <Tile value={`${d.counted}/${d.planned}`} label="REPS COUNTED">
          {d.vsLast ? <Delta value={d.vsLast.reps} /> : null}
        </Tile>
        <Tile value={d.cleanPct === null ? '—' : `${d.cleanPct}%`} label="CLEAN FORM" color={colors.accent}>
          {d.vsLast?.cleanPct !== null && d.vsLast?.cleanPct !== undefined ? <Delta value={d.vsLast.cleanPct} unit="%" /> : null}
        </Tile>
        {d.deepest ? <Tile value={`${d.deepest.deg}°`} label={`DEEPEST · ${d.deepest.joint}`} /> : <Tile value={String(d.noReps)} label="NO REPS" color={d.noReps ? colors.fault : colors.text} />}
        <Tile value={d.pace === null ? '—' : `${d.pace}s`} label="PER REP" />
        <Tile value={clock(d.seconds)} label="TIME" />
      </View>

      <View style={{ flex: 1, flexDirection: 'row', gap: s(12) }}>
        <View style={{ flex: 1, gap: s(12) }}>
          <EveryRep d={d} />
          <View style={{ flex: 1, flexDirection: 'row', gap: s(12) }}>
            <FormBreakdown d={d} />
            <Trend d={d} />
          </View>
        </View>
        <AiCoach state={state} retry={retry} left={left} compared={comparison(d, request)} />
      </View>

      <Text style={{ fontFamily: fonts.sans, fontSize: s(12), color: colors.faint }}>
        Charts are worked out on this TV from your reps. The AI note is written by a model on Amazon Bedrock from the same numbers only — no video or pictures leave your home. Not medical advice.
      </Text>
    </View>
  );
}

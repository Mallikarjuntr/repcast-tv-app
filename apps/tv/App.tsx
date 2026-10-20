import { Barlow_400Regular, Barlow_500Medium, Barlow_600SemiBold, Barlow_700Bold, Barlow_800ExtraBold } from '@expo-google-fonts/barlow';
import { BarlowSemiCondensed_700Bold, BarlowSemiCondensed_800ExtraBold } from '@expo-google-fonts/barlow-semi-condensed';
import { useFonts } from 'expo-font';
import { useKeepAwake } from 'expo-keep-awake';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import type { AnalysisReport, Session as Pairing } from '@spotter/shared';
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, Linking, View } from 'react-native';
import { HomeScreen } from './src/screens/HomeScreen';
import { ModesScreen, type Mode } from './src/screens/ModesScreen';
import { FollowDoneScreen } from './src/screens/FollowDoneScreen';
import { FollowScreen, type FollowResult } from './src/screens/FollowScreen';
import { ReceiptScreen } from './src/screens/ReceiptScreen';
import { CoachSessionScreen } from './src/screens/CoachSessionScreen';
import { AddProfileScreen } from './src/screens/AddProfileScreen';
import { PairScreen } from './src/screens/PairScreen';
import { ProfilesScreen } from './src/screens/ProfilesScreen';
import { ProgressScreen } from './src/screens/ProgressScreen';
import { PickMoveScreen } from './src/screens/PickMoveScreen';
import { AnalysisScreen } from './src/screens/AnalysisScreen';
import { analysisRequest, type AnalysisSource } from './src/analysis';
import { VideoTestScreen } from './src/screens/VideoTestScreen';
import {
  addProfile,
  loadLastProfileId,
  loadProfiles,
  loadSessions,
  saveLastProfileId,
  saveSession,
  streakDays,
  weekView,
  type Profile,
  type SessionRecord,
} from './src/storage';
import { spotterNote, summarizeSession, type MoveResult, type WorkoutSummary } from './src/summary';
import { useCoachNote } from './src/useCoachNote';
import { useVideoReceiver } from './src/useVideoReceiver';
import type { RepNote } from './src/useLiveWorkout';
import { isJudged, MOVES, singleMove, type JudgedStep, type Step } from './src/workouts';
import { profileColour } from './src/components/Avatar';
import { colors } from './src/theme';

void SplashScreen.preventAutoHideAsync();

/**
 * Home → Modes → Pick a move → (camera: Pair → Live → Receipt | follow: Follow → Done). "Another
 * move" goes back to Pick a move; in camera mode that screen keeps the phone's pairing, so the next
 * move needs no new code.
 */
type Screen =
  | { name: 'home' }
  | { name: 'modes' }
  | { name: 'pick'; mode: Mode; pairing?: Pairing }
  | { name: 'pair'; move: JudgedStep; pairing?: Pairing }
  | { name: 'live'; move: JudgedStep; pairing: Pairing }
  | { name: 'follow'; move: Step }
  | { name: 'followDone'; move: Step; result: FollowResult }
  | { name: 'receipt'; receipt: CoachReceiptData }
  | { name: 'analysis'; source: AnalysisSource }
  | { name: 'videoTest' }
  | { name: 'who' }
  | { name: 'addProfile' }
  | { name: 'progress' };

interface CoachReceiptData {
  summary: WorkoutSummary;
  history: RepNote[];
  at: string;
  streak: number;
  /** What "Analyse with AI" sends (numbers only). */
  source: AnalysisSource;
}

/**
 * Holds the phone's video link while you pick the next move or read the receipt, so it doesn't drop
 * and reconnect between moves. A component of its own, so video state changes re-render nothing else.
 */
function KeepVideo({ channel }: { channel: string }) {
  useVideoReceiver(channel);
  return null;
}

function CoachReceipt({ data, onAnother, onAnalyse, onDone }: { data: CoachReceiptData; onAnother: () => void; onAnalyse: () => void; onDone: () => void }) {
  const coach = useCoachNote(data.summary);
  return (
    <ReceiptScreen
      summary={data.summary}
      history={data.history}
      coach={coach}
      streak={data.streak}
      finishedAt={new Date(data.at)}
      onAnother={onAnother}
      onAnalyse={data.history.length > 0 ? onAnalyse : undefined}
      onDone={onDone}
    />
  );
}

/**
 * Holds off the Fire TV screensaver while mounted: mid-workout nobody touches the remote, and the
 * screensaver would send RepCast to the background after ~5 minutes, dropping the phone and video.
 */
function StayAwake() {
  useKeepAwake('spotter-workout');
  return null;
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Barlow_400Regular,
    Barlow_500Medium,
    Barlow_600SemiBold,
    Barlow_700Bold,
    Barlow_800ExtraBold,
    BarlowSemiCondensed_700Bold,
    BarlowSemiCondensed_800ExtraBold,
  });
  const [history, setHistory] = useState<Screen[]>([{ name: 'home' }]);
  const screen = history[history.length - 1]!;

  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  // Who's training: the history below is theirs.
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [lastProfileId, setLastProfileId] = useState<string | null>(null);

  const go = useCallback((next: Screen) => setHistory((h) => [...h, next]), []);
  // Replace the current screen, so BACK skips it (a finished workout can't be re-entered).
  const swap = useCallback((next: Screen) => setHistory((h) => [...h.slice(0, -1), next]), []);
  const home = useCallback(() => setHistory([{ name: 'home' }]), []);

  // The picker opens on the move picked last, so "another set of squats" is one press.
  const [lastMoveId, setLastMoveId] = useState<string | null>(null);

  const choose = useCallback((chosen: Profile) => {
    setProfile(chosen);
    setLastProfileId(chosen.id);
    void saveLastProfileId(chosen.id);
    void loadSessions(chosen.id).then((records) => {
      setSessions(records);
      setLastMoveId(records[records.length - 1]?.move ?? null);
    });
    setHistory([{ name: 'home' }]);
  }, []);

  useEffect(() => {
    void (async () => {
      const [everyone, lastId, url] = await Promise.all([loadProfiles(), loadLastProfileId(), Linking.getInitialURL()]);
      setProfiles(everyone);
      setLastProfileId(lastId);
      // One person goes straight in; a household picks who's training first.
      const only = everyone.length === 1 ? everyone[0]! : null;
      if (only) choose(only);
      else setHistory([{ name: 'who' }]);
      // Hidden Phase 0 spike: adb shell am start -a android.intent.action.VIEW -d spotter://video-test
      if (url?.startsWith('spotter://video-test')) setHistory([{ name: 'videoTest' }]);
    })();
  }, [choose]);

  const saveFor = useCallback((record: SessionRecord) => {
    if (profile) void saveSession(profile.id, record).then(setSessions);
  }, [profile]);

  // AI reports already written, by workout (finish time), so going back and forth doesn't ask again.
  const [reports, setReports] = useState<Record<string, AnalysisReport>>({});

  const finishLive = useCallback(
    (move: JudgedStep, pairing: Pairing, moves: MoveResult[], seconds: number) => {
      const { summary, history } = summarizeSession(moves, seconds);
      const record: SessionRecord = {
        at: new Date().toISOString(),
        mode: 'coach',
        title: move.name,
        move: move.id,
        reps: summary.counted,
        seconds,
        cleanReps: summary.good,
        nextTime: spotterNote(summary).nextTime,
      };
      // A move ended before a single attempt isn't a workout; it doesn't go in the history or the streak.
      if (summary.attempts > 0) saveFor(record);
      swap({
        name: 'receipt',
        receipt: {
          summary,
          history,
          at: record.at,
          streak: streakDays(summary.attempts > 0 ? [...sessions, record] : sessions),
          source: {
            pairing: { code: pairing.code, channel: pairing.channel },
            move: { id: move.id, name: move.name },
            plan: { sets: move.sets, reps: move.reps },
            seconds,
            history,
            at: record.at,
          },
        },
      });
    },
    [saveFor, sessions, swap],
  );

  const finishFollow = useCallback(
    (move: Step, result: FollowResult) => {
      const didSomething = move.kind === 'reps' ? result.reps > 0 : result.seconds >= 5;
      if (didSomething) saveFor({ at: new Date().toISOString(), mode: 'core', title: move.name, move: move.id, reps: result.reps, seconds: result.seconds });
      swap({ name: 'followDone', move, result });
    },
    [saveFor, swap],
  );

  const pick = useCallback(
    (mode: Mode, move: Step, pairing?: Pairing) => {
      setLastMoveId(move.id);
      if (mode === 'coach' && isJudged(move)) go({ name: 'pair', move, pairing });
      else go({ name: 'follow', move });
    },
    [go],
  );

  // The pairing is kept on the picker underneath, so BACK or "Another move" lands on a linked picker.
  const startLive = useCallback((move: JudgedStep, pairing: Pairing) => {
    setHistory((h) => {
      const below = h[h.length - 2];
      const keep = below?.name === 'pick' ? [...h.slice(0, -2), { ...below, pairing }] : h.slice(0, -1);
      return [...keep, { name: 'live', move, pairing }];
    });
  }, []);
  const back = useCallback(() => {
    if (history.length <= 1) return false;
    setHistory((h) => h.slice(0, -1));
    return true;
  }, [history.length]);


  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync();
  }, [fontsLoaded]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', back);
    return () => sub.remove();
  }, [back]);

  // Camera mode, linked: the picker underneath carries the pairing until you go home or back out.
  const linked = history.find((s): s is Extract<Screen, { name: 'pick' }> => s.name === 'pick' && !!s.pairing)?.pairing ?? null;

  const ready = profile !== null || screen.name === 'who' || screen.name === 'addProfile' || screen.name === 'videoTest';
  if (!fontsLoaded || !ready) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar hidden />
      {linked ? <KeepVideo channel={linked.channel} /> : null}
      {screen.name === 'pair' || screen.name === 'live' || screen.name === 'follow' ? <StayAwake /> : null}
      {screen.name === 'home' && (
        <HomeScreen
          sessions={sessions}
          onStart={() => go({ name: 'modes' })}
          profileName={profile?.name ?? ''}
          profileColour={profileColour(profiles.findIndex((p) => p.id === profile?.id))}
          onProgress={() => go({ name: 'progress' })}
          onSwitch={() => go({ name: 'who' })}
        />
      )}
      {screen.name === 'who' && (
        <ProfilesScreen profiles={profiles} lastId={lastProfileId} onChoose={choose} onAdd={() => go({ name: 'addProfile' })} onBack={history.length > 1 ? back : undefined} />
      )}
      {screen.name === 'addProfile' && (
        <AddProfileScreen
          onCancel={back}
          onSave={(name) =>
            void addProfile(name).then((everyone) => {
              setProfiles(everyone);
              choose(everyone[everyone.length - 1]!);
            })
          }
        />
      )}
      {screen.name === 'progress' && profile && <ProgressScreen profile={profile} sessions={sessions} onBack={back} />}
      {screen.name === 'videoTest' && <VideoTestScreen />}
      {screen.name === 'modes' && (
        <ModesScreen
          coachToday={`${MOVES.filter(isJudged).length} moves · every rep checked`}
          coreToday={`${MOVES.length} moves · holds and planks too`}
          onChoose={(mode) => go({ name: 'pick', mode })}
          onBack={back}
        />
      )}
      {screen.name === 'pick' && (
        <PickMoveScreen mode={screen.mode} pairing={screen.pairing ?? null} lastMoveId={lastMoveId} onPick={(move) => pick(screen.mode, move, screen.pairing)} onBack={back} />
      )}
      {screen.name === 'pair' && (
        <PairScreen
          exercise={{ id: screen.move.engine, name: screen.move.name }}
          session={screen.pairing}
          // Replaces the pairing screen, so BACK from the move doesn't land on a countdown that starts it again.
          onReady={(pairing) => startLive(screen.move, pairing)}
          onBack={back}
        />
      )}
      {screen.name === 'live' && (
        <CoachSessionScreen channel={screen.pairing.channel} session={singleMove(screen.move)} onFinish={(moves, seconds) => finishLive(screen.move, screen.pairing, moves, seconds)} />
      )}
      {screen.name === 'receipt' && (
        <CoachReceipt data={screen.receipt} onAnother={back} onAnalyse={() => go({ name: 'analysis', source: screen.receipt.source })} onDone={home} />
      )}
      {screen.name === 'analysis' && (
        <AnalysisScreen
          request={analysisRequest(screen.source, sessions)}
          cached={reports[screen.source.at]}
          onReport={(report) => setReports((r) => ({ ...r, [screen.source.at]: report }))}
          onBack={back}
        />
      )}
      {screen.name === 'follow' && <FollowScreen session={singleMove(screen.move)} onFinish={(result) => finishFollow(screen.move, result)} />}
      {screen.name === 'followDone' && (
        <FollowDoneScreen move={screen.move} reps={screen.result.reps} seconds={screen.result.seconds} week={weekView(sessions)} onAnother={back} onHome={home} />
      )}
    </View>
  );
}

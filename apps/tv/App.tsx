import { Fraunces_400Regular_Italic, Fraunces_500Medium, Fraunces_600SemiBold, Fraunces_600SemiBold_Italic } from '@expo-google-fonts/fraunces';
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import { InstrumentSans_400Regular, InstrumentSans_500Medium, InstrumentSans_600SemiBold } from '@expo-google-fonts/instrument-sans';
import { Kalam_400Regular } from '@expo-google-fonts/kalam';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, View } from 'react-native';
import { HomeScreen } from './src/screens/HomeScreen';
import { ModesScreen } from './src/screens/ModesScreen';
import { FollowDoneScreen } from './src/screens/FollowDoneScreen';
import { FollowScreen, type FollowResult } from './src/screens/FollowScreen';
import { ReceiptScreen } from './src/screens/ReceiptScreen';
import { LiveScreen } from './src/screens/LiveScreen';
import { PairScreen } from './src/screens/PairScreen';
import { SwapScreen } from './src/screens/SwapScreen';
import { freeCoachSessionsLeft, loadSessions, loadSwaps, saveSession, saveSwaps, streakDays, weekView, type SessionRecord } from './src/storage';
import { spotterNote, summarize, type WorkoutSummary } from './src/summary';
import { useCoachNote } from './src/useCoachNote';
import type { RepNote, WorkoutPlan } from './src/useLiveWorkout';
import { applySwaps, estimateSeconds, LEGS_GENTLY, type Swaps } from './src/workouts';
import { colors } from './src/theme';

void SplashScreen.preventAutoHideAsync();

type Screen =
  | { name: 'home' }
  | { name: 'modes' }
  | { name: 'pair' }
  | { name: 'live'; channel: string }
  | { name: 'follow' }
  | { name: 'swap' }
  | { name: 'followDone'; result: FollowResult }
  | { name: 'receipt'; receipt: CoachReceiptData };

interface CoachReceiptData {
  summary: WorkoutSummary;
  history: RepNote[];
  at: string;
  sessionNumber: number;
  streak: number;
}

function CoachReceipt({ data, onDone }: { data: CoachReceiptData; onDone: () => void }) {
  const coach = useCoachNote(data.summary);
  return (
    <ReceiptScreen
      summary={data.summary}
      history={data.history}
      coach={coach}
      sessionNumber={data.sessionNumber}
      streak={data.streak}
      finishedAt={new Date(data.at)}
      onDone={onDone}
    />
  );
}

// Today's sample session until plans come from the backend.
const SQUAT_PLAN: WorkoutPlan = { exercise: 'squat', name: 'Squats', sets: 3, reps: 12, restSeconds: 30 };

export default function App() {
  const [fontsLoaded] = useFonts({
    Fraunces_400Regular_Italic,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Fraunces_600SemiBold_Italic,
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    Kalam_400Regular,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });
  const [history, setHistory] = useState<Screen[]>([{ name: 'home' }]);
  const screen = history[history.length - 1]!;

  const [sessions, setSessions] = useState<SessionRecord[]>([]);

  const go = useCallback((next: Screen) => setHistory((h) => [...h, next]), []);
  // Replace the current screen, so BACK skips it (a finished workout can't be re-entered).
  const swap = useCallback((next: Screen) => setHistory((h) => [...h.slice(0, -1), next]), []);
  const home = useCallback(() => setHistory([{ name: 'home' }]), []);

  const [swaps, setSwaps] = useState<Swaps>({});
  const today = useMemo(() => applySwaps(LEGS_GENTLY, swaps), [swaps]);

  useEffect(() => {
    void loadSessions().then(setSessions);
    void loadSwaps().then(setSwaps);
  }, []);

  const finishLive = useCallback(
    (history: RepNote[], seconds: number) => {
      const summary = summarize(SQUAT_PLAN, history, seconds);
      const record: SessionRecord = {
        at: new Date().toISOString(),
        mode: 'coach',
        title: SQUAT_PLAN.name,
        reps: summary.counted,
        seconds,
        cleanReps: summary.good,
        nextTime: spotterNote(summary).nextTime,
      };
      void saveSession(record).then(setSessions);
      swap({
        name: 'receipt',
        receipt: { summary, history, at: record.at, sessionNumber: sessions.length + 1, streak: streakDays([...sessions, record]) },
      });
    },
    [sessions, swap],
  );

  const finishFollow = useCallback(
    (result: FollowResult) => {
      void saveSession({ at: new Date().toISOString(), mode: 'core', title: 'Legs, gently.', reps: result.reps, seconds: result.seconds }).then(setSessions);
      swap({ name: 'followDone', result });
    },
    [swap],
  );
  const back = useCallback(() => {
    if (history.length <= 1) return false;
    setHistory((h) => h.slice(0, -1));
    return true;
  }, [history.length]);

  const finishSwaps = useCallback(
    (next: Swaps) => {
      setSwaps(next);
      void saveSwaps(next);
      back();
    },
    [back],
  );

  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync();
  }, [fontsLoaded]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', back);
    return () => sub.remove();
  }, [back]);

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.paper }} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <StatusBar hidden />
      {screen.name === 'home' && (
        <HomeScreen
          today={today}
          sessions={sessions}
          swapCount={Object.keys(swaps).length}
          onStart={() => go({ name: 'modes' })}
          onSwap={() => go({ name: 'swap' })}
          onNoCamera={() => go({ name: 'follow' })}
        />
      )}
      {screen.name === 'swap' && <SwapScreen base={LEGS_GENTLY} swaps={swaps} onDone={finishSwaps} />}
      {screen.name === 'modes' && (
        <ModesScreen
          sessionLabel={`LEGS, GENTLY · ${Math.round(estimateSeconds(today) / 60)} MIN`}
          freeCoachSessionsLeft={freeCoachSessionsLeft(sessions)}
          onChoose={(mode) => go(mode === 'coach' ? { name: 'pair' } : { name: 'follow' })} />
      )}
      {screen.name === 'pair' && <PairScreen onReady={(channel) => go({ name: 'live', channel })} />}
      {screen.name === 'live' && <LiveScreen channel={screen.channel} plan={SQUAT_PLAN} onFinish={finishLive} />}
      {screen.name === 'receipt' && <CoachReceipt data={screen.receipt} onDone={home} />}
      {screen.name === 'follow' && <FollowScreen session={today} onFinish={finishFollow} />}
      {screen.name === 'followDone' && (
        <FollowDoneScreen
          session={today}
          reps={screen.result.reps}
          seconds={screen.result.seconds}
          week={weekView(sessions)}
          onHome={home}
          onCoach={() => setHistory([{ name: 'home' }, { name: 'modes' }, { name: 'pair' }])}
        />
      )}
    </View>
  );
}

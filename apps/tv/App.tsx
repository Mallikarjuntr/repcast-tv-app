import { Fraunces_400Regular_Italic, Fraunces_500Medium, Fraunces_600SemiBold, Fraunces_600SemiBold_Italic } from '@expo-google-fonts/fraunces';
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import { InstrumentSans_400Regular, InstrumentSans_500Medium, InstrumentSans_600SemiBold } from '@expo-google-fonts/instrument-sans';
import { Kalam_400Regular } from '@expo-google-fonts/kalam';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, View } from 'react-native';
import { HomeScreen } from './src/screens/HomeScreen';
import { ModesScreen, type Mode } from './src/screens/ModesScreen';
import { FollowDoneScreen } from './src/screens/FollowDoneScreen';
import { FollowScreen, type FollowResult } from './src/screens/FollowScreen';
import { NextUpScreen } from './src/screens/NextUpScreen';
import { LiveScreen } from './src/screens/LiveScreen';
import { PairScreen } from './src/screens/PairScreen';
import { loadSessions, saveSession, weekView, type SessionRecord } from './src/storage';
import type { WorkoutPlan } from './src/useLiveWorkout';
import { LEGS_GENTLY } from './src/workouts';
import { colors } from './src/theme';

void SplashScreen.preventAutoHideAsync();

type Screen =
  | { name: 'home' }
  | { name: 'modes' }
  | { name: 'pair' }
  | { name: 'live'; channel: string }
  | { name: 'follow' }
  | { name: 'followDone'; result: FollowResult }
  | { name: 'next'; mode: Mode; reps?: number };

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

  useEffect(() => {
    void loadSessions().then(setSessions);
  }, []);

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
      {screen.name === 'home' && <HomeScreen today={LEGS_GENTLY} sessions={sessions} onStart={() => go({ name: 'modes' })} onNoCamera={() => go({ name: 'follow' })} />}
      {screen.name === 'modes' && (
        <ModesScreen freeCoachSessionsLeft={2} onChoose={(mode) => go(mode === 'coach' ? { name: 'pair' } : { name: 'follow' })} />
      )}
      {screen.name === 'pair' && <PairScreen onReady={(channel) => go({ name: 'live', channel })} />}
      {screen.name === 'live' && <LiveScreen channel={screen.channel} plan={SQUAT_PLAN} onFinish={(history) => go({ name: 'next', mode: 'coach', reps: history.length })} />}
      {screen.name === 'follow' && <FollowScreen session={LEGS_GENTLY} onFinish={finishFollow} />}
      {screen.name === 'followDone' && (
        <FollowDoneScreen
          session={LEGS_GENTLY}
          reps={screen.result.reps}
          seconds={screen.result.seconds}
          week={weekView(sessions)}
          onHome={home}
          onCoach={() => setHistory([{ name: 'home' }, { name: 'modes' }, { name: 'pair' }])}
        />
      )}
      {screen.name === 'next' && (
        <NextUpScreen
          title={screen.reps ? `${screen.reps} reps done — your receipt` : 'The live workout'}
          detail="Next: the workout receipt, with your AI coach's handwritten note and the plan for next time."
          onBack={back}
        />
      )}
    </View>
  );
}

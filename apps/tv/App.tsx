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
import { NextUpScreen } from './src/screens/NextUpScreen';
import { LiveScreen } from './src/screens/LiveScreen';
import { PairScreen } from './src/screens/PairScreen';
import type { WorkoutPlan } from './src/useLiveWorkout';
import { colors } from './src/theme';

void SplashScreen.preventAutoHideAsync();

type Screen = { name: 'home' } | { name: 'modes' } | { name: 'pair' } | { name: 'live'; channel: string } | { name: 'next'; mode: Mode; reps?: number };

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

  const go = useCallback((next: Screen) => setHistory((h) => [...h, next]), []);
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
      {screen.name === 'home' && <HomeScreen onStart={() => go({ name: 'modes' })} onNoCamera={() => go({ name: 'next', mode: 'core' })} />}
      {screen.name === 'modes' && (
        <ModesScreen freeCoachSessionsLeft={2} onChoose={(mode) => go(mode === 'coach' ? { name: 'pair' } : { name: 'next', mode })} />
      )}
      {screen.name === 'pair' && <PairScreen onReady={(channel) => go({ name: 'live', channel })} />}
      {screen.name === 'live' && <LiveScreen channel={screen.channel} plan={SQUAT_PLAN} onFinish={(history) => go({ name: 'next', mode: 'coach', reps: history.length })} />}
      {screen.name === 'next' && (
        <NextUpScreen
          title={screen.mode === 'coach' ? (screen.reps ? `${screen.reps} reps done — your receipt` : 'The live workout') : 'Your guided workout'}
          detail={
            screen.mode === 'coach'
              ? 'Next: the workout receipt, with your AI coach\'s handwritten note and the plan for next time.'
              : 'Next comes the follow-along workout: a voice coach, timers and a tempo beat — no camera needed.'
          }
          onBack={back}
        />
      )}
    </View>
  );
}

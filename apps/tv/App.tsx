import { Archivo_400Regular, Archivo_500Medium, Archivo_600SemiBold, Archivo_700Bold, Archivo_800ExtraBold } from '@expo-google-fonts/archivo';
import { ArchivoNarrow_600SemiBold, ArchivoNarrow_700Bold } from '@expo-google-fonts/archivo-narrow';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, Linking, View } from 'react-native';
import { HomeScreen } from './src/screens/HomeScreen';
import { ModesScreen } from './src/screens/ModesScreen';
import { FollowDoneScreen } from './src/screens/FollowDoneScreen';
import { FollowScreen, type FollowResult } from './src/screens/FollowScreen';
import { ReceiptScreen } from './src/screens/ReceiptScreen';
import { CoachSessionScreen } from './src/screens/CoachSessionScreen';
import { AddProfileScreen } from './src/screens/AddProfileScreen';
import { PairScreen } from './src/screens/PairScreen';
import { ProfilesScreen } from './src/screens/ProfilesScreen';
import { ProgressScreen } from './src/screens/ProgressScreen';
import { SwapScreen } from './src/screens/SwapScreen';
import { VideoTestScreen } from './src/screens/VideoTestScreen';
import {
  addProfile,
  freeCoachSessionsLeft,
  loadLastProfileId,
  loadProfiles,
  loadSessions,
  loadSwaps,
  saveLastProfileId,
  saveSession,
  saveSwaps,
  streakDays,
  weekView,
  type Profile,
  type SessionRecord,
} from './src/storage';
import { spotterNote, summarizeSession, type MoveResult, type WorkoutSummary } from './src/summary';
import { useCoachNote } from './src/useCoachNote';
import type { RepNote } from './src/useLiveWorkout';
import { applySwaps, estimateSeconds, LEGS_GENTLY, type Swaps } from './src/workouts';
import { profileColour } from './src/components/Avatar';
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
  | { name: 'receipt'; receipt: CoachReceiptData }
  | { name: 'videoTest' }
  | { name: 'who' }
  | { name: 'addProfile' }
  | { name: 'progress' };

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

export default function App() {
  const [fontsLoaded] = useFonts({
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_600SemiBold,
    Archivo_700Bold,
    Archivo_800ExtraBold,
    ArchivoNarrow_600SemiBold,
    ArchivoNarrow_700Bold,
  });
  const [history, setHistory] = useState<Screen[]>([{ name: 'home' }]);
  const screen = history[history.length - 1]!;

  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  // Who's training: everything below (history, swaps, the free coaching count) is theirs.
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [lastProfileId, setLastProfileId] = useState<string | null>(null);

  const go = useCallback((next: Screen) => setHistory((h) => [...h, next]), []);
  // Replace the current screen, so BACK skips it (a finished workout can't be re-entered).
  const swap = useCallback((next: Screen) => setHistory((h) => [...h.slice(0, -1), next]), []);
  const home = useCallback(() => setHistory([{ name: 'home' }]), []);

  const [swaps, setSwaps] = useState<Swaps>({});
  const today = useMemo(() => applySwaps(LEGS_GENTLY, swaps), [swaps]);

  const choose = useCallback((chosen: Profile) => {
    setProfile(chosen);
    setLastProfileId(chosen.id);
    void saveLastProfileId(chosen.id);
    void loadSessions(chosen.id).then(setSessions);
    void loadSwaps(chosen.id).then(setSwaps);
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

  const finishLive = useCallback(
    (moves: MoveResult[], seconds: number) => {
      const { summary, history } = summarizeSession(moves, seconds);
      const record: SessionRecord = {
        at: new Date().toISOString(),
        mode: 'coach',
        title: 'Legs, gently.',
        reps: summary.counted,
        seconds,
        cleanReps: summary.good,
        nextTime: spotterNote(summary).nextTime,
      };
      saveFor(record);
      swap({
        name: 'receipt',
        receipt: { summary, history, at: record.at, sessionNumber: sessions.length + 1, streak: streakDays([...sessions, record]) },
      });
    },
    [saveFor, sessions, swap],
  );

  const finishFollow = useCallback(
    (result: FollowResult) => {
      saveFor({ at: new Date().toISOString(), mode: 'core', title: 'Legs, gently.', reps: result.reps, seconds: result.seconds });
      swap({ name: 'followDone', result });
    },
    [saveFor, swap],
  );
  const back = useCallback(() => {
    if (history.length <= 1) return false;
    setHistory((h) => h.slice(0, -1));
    return true;
  }, [history.length]);

  const finishSwaps = useCallback(
    (next: Swaps) => {
      setSwaps(next);
      if (profile) void saveSwaps(profile.id, next);
      back();
    },
    [back, profile],
  );

  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync();
  }, [fontsLoaded]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', back);
    return () => sub.remove();
  }, [back]);

  const ready = profile !== null || screen.name === 'who' || screen.name === 'addProfile' || screen.name === 'videoTest';
  if (!fontsLoaded || !ready) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar hidden />
      {screen.name === 'home' && (
        <HomeScreen
          today={today}
          sessions={sessions}
          swapCount={Object.keys(swaps).length}
          onStart={() => go({ name: 'modes' })}
          onSwap={() => go({ name: 'swap' })}
          onNoCamera={() => go({ name: 'follow' })}
          profileName={profile?.name ?? ''}
          profileColour={profileColour(profiles.findIndex((p) => p.id === profile?.id))}
          onProgress={() => go({ name: 'progress' })}
          onSwitch={() => go({ name: 'who' })}
        />
      )}
      {screen.name === 'who' && <ProfilesScreen profiles={profiles} lastId={lastProfileId} onChoose={choose} onAdd={() => go({ name: 'addProfile' })} />}
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
      {screen.name === 'swap' && <SwapScreen base={LEGS_GENTLY} swaps={swaps} onDone={finishSwaps} />}
      {screen.name === 'modes' && (
        <ModesScreen
          sessionLabel={`LEGS, GENTLY · ${Math.round(estimateSeconds(today) / 60)} MIN`}
          freeCoachSessionsLeft={freeCoachSessionsLeft(sessions)}
          onChoose={(mode) => go(mode === 'coach' ? { name: 'pair' } : { name: 'follow' })} />
      )}
      {screen.name === 'pair' && <PairScreen onReady={(channel) => go({ name: 'live', channel })} />}
      {screen.name === 'live' && <CoachSessionScreen channel={screen.channel} session={today} onFinish={finishLive} />}
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

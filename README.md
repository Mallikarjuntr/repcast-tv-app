# Spotter

**Your living-room spotter.** A Fire TV fitness coach that checks your form through the phone you already own — and calls out every rep like a coach in the room. Video goes only from your phone to your TV — never to the cloud.

- **Core mode (free):** guided workouts with a 3D trainer, a coach's voice, timers, tempo-based rep counting, streaks and progress — no camera needed.
- **Smart coaching:** your phone becomes the camera. It tracks your body with MediaPipe, judges every rep (good, needs a fix, or no rep — and why), and the TV shows your live picture with your skeleton drawn on it, the count, form notes, and a workout receipt at the end.

> Built for Build, Ship, Shape: Amazon Developer Hackathon 2026 (Fire TV track).

## Repositories

| Repo | What's inside |
|---|---|
| [spotter-tv-app](https://github.com/Mallikarjuntr/spotter-tv-app) | Fire TV app + phone camera web app (this repo) |
| [spotter-backend](https://github.com/Mallikarjuntr/spotter-backend) | AWS stack (SAM): pairing API, live link (AppSync Events), coach voice (Polly) — deployed by GitHub Actions |
| [spotter-movement](https://github.com/Mallikarjuntr/spotter-movement) | Open-source movement engine: rep and hold detection and form checks from pose landmarks |

## How it works

```
Phone (web page, camera)                       AWS                          Fire TV (React Native)
MediaPipe pose ─▶ spotter-movement ─ reps ──▶ AppSync Events channel ──▶ rep count, verdicts, receipt
        │                                       (pairing via 4-digit code)
        └─ camera video + pose points ── WebRTC, straight over home Wi-Fi ──▶ live picture + skeleton
```

1. The TV asks the backend for a 4-digit code and shows it with a QR code.
2. The phone opens the camera page from the QR code (nothing to install), links to the TV, and runs pose tracking and rep judging on the phone.
3. Reps, verdicts and framing go to the TV over an AppSync Events channel. The camera picture and pose points go straight from phone to TV over WebRTC on the home Wi-Fi; the set-up messages for that connection use the same channel.

## What's in this repo

| Path | What |
|---|---|
| `apps/tv` | Fire TV app: Expo SDK 57 + [react-native-tvos](https://github.com/react-native-tvos/react-native-tvos) 0.86, react-native-webrtc |
| `apps/camera` | Phone camera web app: TypeScript + Vite, MediaPipe Pose Landmarker, hosted on GitHub Pages |
| `packages/shared` | What the phone and TV share: message types, backend endpoints, the AppSync Events client |
| `tools/fake-phone.mjs` | Plays the phone's side of a workout against the real backend, to test the TV without a phone |
| `tools/trainer` | Blender scripts that render the 3D trainer clips ([how](tools/trainer/README.md)) |
| `tools/voice` | Coach voice lines (recorded with Amazon Polly by the backend) |
| `tools/brand` | App icon, TV banner and Appstore images ([how](docs/store/README.md)) |
| `docs/` | [How it's tested](docs/TESTING.md), [friction log](docs/FRICTION.md), screenshots |

## Run it

You need **Node.js 24** and npm. Install everything once from the repo root:

```bash
npm ci
```

The apps use the deployed Spotter backend out of the box (public endpoints in `packages/shared/src/config.ts`), so there is nothing to configure. To run your own backend, deploy [spotter-backend](https://github.com/Mallikarjuntr/spotter-backend) and put its stack outputs in that file.

### Phone camera app

The published version is at **https://mallikarjuntr.github.io/spotter-tv-app/** — this is what the TV's QR code opens.

To run it locally:

```bash
npm run dev:camera      # http://localhost:5173
npm run build:camera    # production build in apps/camera/dist
```

Browsers only allow the camera on HTTPS pages or on `localhost`, and the backend only accepts the published site and `localhost:5173` / `:4173`, so to test with a real phone use the published site.

Page options (add to the URL): `?code=1234` links to that TV, `?model=full` uses the larger pose model, `?video=off` turns off the video to the TV, and `?src=<video url>` replays a recorded exercise clip instead of the camera (the clip's host must allow CORS, as Wikimedia Commons does) — handy for testing the TV without exercising.

### Fire TV app

You need **JDK 17** and the **Android SDK** (platform 36, build-tools 36). The app is Android-only.

```bash
cd apps/tv
EXPO_TV=1 CI=1 npx expo prebuild --platform android --clean --no-install   # generates android/
cd android
EXPO_TV=1 NODE_ENV=production ./gradlew assembleRelease -PreactNativeArchitectures=armeabi-v7a,arm64-v8a
```

The APK is `apps/tv/android/app/build/outputs/apk/release/app-release.apk`. Keep `armeabi-v7a` in the list: Fire TV Sticks like the 3rd gen run a 32-bit Fire OS and can't install a 64-bit-only build.

**Install on a Fire TV:** turn on *Settings → My Fire TV → Developer Options → ADB debugging* (if Developer Options is hidden, open *About* and select the device name seven times), find the TV's IP address (*Settings → My Fire TV → About → Network*), then:

```bash
adb connect <fire-tv-ip>:5555        # accept the prompt on the TV
adb install -r app/build/outputs/apk/release/app-release.apk
```

Spotter then appears in the Fire TV's apps list. It also runs on the Android TV emulator.

### Try a coached workout

1. On the TV: **Start session → Start coaching**. The TV shows a QR code and a 4-digit code.
2. On a phone **on the same Wi-Fi as the TV**: scan the QR code (or open the camera page and type the code), tap **Start camera** and allow the camera.
3. Prop the phone at hip height about 2–3 m away, turned about 45°. When the TV ticks head, hips, knees and feet, press **Start workout** and squat.

No phone handy? `node tools/fake-phone.mjs <code> --start-after 8 --rest 32` plays a scripted 3 × 12 squat session against the code on the TV (no video). Or open the camera page on a computer with `?code=<code>&src=<clip url>` to send a recorded squat, with video, to the TV.

## Tests

```bash
npm run build:camera                      # typecheck + build the camera app (what CI runs)
cd apps/tv && npx tsc --noEmit            # typecheck the TV app
```

The rep engine has its own unit tests in [spotter-movement](https://github.com/Mallikarjuntr/spotter-movement) (`npm test`), and `apps/camera/replay.html` replays recorded videos through the exact phone pipeline. Results, device measurements and known limits are in [docs/TESTING.md](docs/TESTING.md).

## License

MIT

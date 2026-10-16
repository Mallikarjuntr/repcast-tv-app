# How Spotter's rep counting is tested

Spotter has to be an **honest spotter**: count good reps, say plainly when a rep doesn't count and why, and never count things that aren't the exercise. It is tested at three levels.

## 1. Unit tests (`spotter-movement`, 29 tests)

Synthetic pose sequences for every rule, including the failure cases reported in the first real-phone test:

| Scenario | Expected |
|---|---|
| Deep, clean squats | `good`, counted |
| Slightly shallow squat | `fix`, counted, "Go a little lower" |
| Half squat (above 120° at the knee) | `no-rep`, "Not deep enough" |
| Knees caving in a little / badly | `fix` / `no-rep` |
| Chest dropping a little / badly | `fix` / `no-rep` |
| Person lying down moving their legs | never counted |
| Phone shaking while the person stands still | never counted |
| Lunges during a squat set | `no-rep`, "That's a lunge" |
| Squats during a lunge set | `no-rep`, "Step one foot forward" |
| Side-on view with legs stacked | stance not guessed |
| Soft-kneed standing posture | still counts (standing angle is learned per person) |
| Reps too fast or too slow | ignored |

## 2. Replay test bench (real video)

`apps/camera/replay.html` runs a recorded video through **the exact pipeline the phone uses** — MediaPipe Pose Landmarker (lite) and the `spotter-movement` engine — stepping frame by frame at the phone's frame rate (≈15 fps), and reports every verdict plus a per-frame trace of the engine's internal measurements.

```
replay.html?src=<video url>&exercise=squat|lunge&fps=15&model=lite|full&trace=17-25&until=40
```

Test clips are openly licensed exercise videos streamed from Wikimedia Commons (not stored in this repo).

### Results (lite model, 10–12 fps)

| Clip | Set | Result | Notes |
|---|---|---|---|
| *Muscle Strengthening at Home – Half squat* (public domain, 320×240, front view) | squat | **5 of 5 good** | Low resolution, person small in frame. Before tuning: 0 counted |
| *Strength Training Circuit – Forward Lunge* (public domain, 1080p, side view) | squat | 3 counted, 6 rejected (lunge, stepping foot, chest) | Before: 5 lunges counted as squats. The 3 still counted are pure side-on lunges where the pose model stacks both legs — see limits |
| same | lunge | lunges with both legs visible count; side-on ones are not wrongly rejected | |

### What real video taught us (and the fixes)

| Finding | Fix |
|---|---|
| Real deep squats bottom out at 50–65°, half squats at 105–125° (from the first phone test) | Depth: good ≤ 95°, counts with a fix ≤ 120°, no rep above |
| Some people never straighten their knees past ~152° when standing | The engine learns each person's standing angle (80th percentile of upright frames) |
| Ankle points jitter by ~30% of leg length in low-resolution video | Drift and stance are judged as percentiles across the rep, from an anchor averaged over standing frames |
| From the side, the pose model often draws the hidden leg on top of the visible one (lite and full models alike) | A small knee gap only counts as a squat stance when the person isn't side-on; the phone and TV ask the user to turn the phone ~45° |
| The torso comes upright a moment after the legs straighten | 1.2 s grace before judging "finish standing tall" |
| On the Fire TV Stick, a plain squat clip judged as **sumo squats** counted as 20+ clean reps: nothing checked the stance | Sumo squats measure foot width while standing at the start of each rep (ankle span ÷ shoulder span, which holds from a 45° camera). Measured: real squat from ~45° 0.83–1.08 (median 0.90), trainer squat ~1.17, trainer sumo squat 2.17–2.43. Below 1.25 → no rep ("Feet wider — that was a squat, this set is sumo squats"), below 1.5 → counts with "Step your feet a little wider". Not judged side-on or without visible ankles. Replay: the Commons squat clip as sumo squats went from 2/2 clean to 0/2 with that reason; the trainer's sumo squat stays clean; the same clip as plain squats is unchanged (2/2 clean) |

## 3. End-to-end on the TV

`tools/fake-phone.mjs` plays the phone's side of a coached workout against the real backend, so the whole TV flow can be tested without anyone squatting. It pairs with the code on the TV, sends framing, a moving outline and a scripted 3 × 12 squat session with clean reps, form notes (knees caving) and no-reps (not deep enough):

```bash
node tools/fake-phone.mjs 1234 --start-after 8 --rest 32
```

Press "Start workout" on the TV within `--start-after` seconds. The script's attempts are known in advance, so the receipt can be checked exactly: knees caved on reps 2, 6, 16 and 32, three attempts didn't count, 32 of 36 reps were clean (89%) — which is what the receipt shows (`docs/screenshots/18-receipt.png`, `19-receipt-every-rep.png`). Screenshots of every state are in `docs/screenshots/`.

## 4. On a real Fire TV

Tested on a **Fire TV Stick 3rd gen (AFTSSS)**: Fire OS 7.7.1.7 (Android 9, API 28), MediaTek MT8695 (4 × Cortex-A53), PowerVR GE8300 (OpenGL ES 3.2, Vulkan 1.1), about 900 MB of RAM. Screenshots taken on the stick are in `docs/screenshots/fire-tv/`.

- **This stick is 32-bit only (`armeabi-v7a`)**, so the APK must include 32-bit libraries:
  `EXPO_TV=1 NODE_ENV=production ./gradlew assembleRelease -PreactNativeArchitectures=armeabi-v7a,arm64-v8a`
- Install over Wi-Fi: turn on *Settings → My Fire TV → Developer Options → ADB debugging*, then `adb connect <stick-ip>:5555` and accept the prompt on the TV. The stick announces itself on the network as `_amzn-wplay._tcp` (`dns-sd -B _amzn-wplay._tcp`).
- Results: cold start 3.2 s; about 76 MB of memory at Home and about 134 MB after a full coached workout. Pairing, the live outline, rep verdicts and the receipt all work over the real AWS backend (driven by `tools/fake-phone.mjs`). The voice coach binds to the stick's own speech engine (Ivona).
- **Voice:** the stick's built-in text-to-speech engine accepts requests but plays nothing (friction log #10), so every coach line is pre-recorded with Amazon Polly and bundled (56 lines, 872 KB). Confirmed on the stick: the audio service logs a new media player from the app for each count, on the beat.
- **Smoothness:** the follow-along screen used to re-render entirely ten times a second, and the figure (SVG) was re-uploaded to the GPU as a bitmap every frame. Now the clock lives outside React state, the figure animates on its own ~30 fps loop, and it is drawn with native views. Measured over 10 s of squats: bitmap uploads 91 → 0, app CPU ~140% → ~95% (of 400%), no missed vsyncs; median frame 20 ms. The remaining slow frames line up with the stick's memory pressure (~46 MB free, swap nearly full).

- **3D trainer (Follow along):** each move plays a pre-rendered loop of a 3D trainer drawn in the app's style (`tools/trainer`). On the stick the follow-along screen drops from ~55% slow frames with the drawn figure to **~2% (median 8 ms)** with the trainer video, because the stick decodes H.264 in hardware. The trainer holds still during the coach's intro and stays on the beat (resynced if it drifts > 0.15 s). Screenshots: `docs/screenshots/fire-tv/6-9`.

## 5. Live video from the phone (WebRTC)

In Smart coaching the TV shows the phone's camera with the user's skeleton drawn on it. The video and the pose points go straight from phone to TV over WebRTC on the home Wi-Fi; only the connection set-up messages use the AppSync Events channel (its `/rtc` sub-channel). All numbers below were measured on the Fire TV Stick 3rd gen.

**Go / no-go first.** Before touching any screen, a hidden test screen (`spotter://video-test`) received a test pattern from a computer on the same Wi-Fi, to check the stick could afford live video:

| Measure | Target | Result |
|---|---|---|
| Frame rate (854×480) | ≥ 15 fps | 22–24 fps |
| Decoding | hardware | H.264 in hardware (`OMX.MTK.VIDEO.DECODER.AVC`) |
| Route | direct on the Wi-Fi | yes (host → peer-reflexive, UDP), round trip 6–16 ms |
| App memory | < 250 MB | 96–118 MB over 10 minutes |
| Stability | no crash or low-memory kill in 10 min | none; free memory steady at ~245 MB |
| Frames dropped | — | 2.6% (mostly one 30-second burst) |
| APK size | — | 48.6 → 66.9 MB (both ABIs) |

**Connection tests.** The sender dropping and coming back (TV shows "reconnecting" and keeps the last frame, then a fresh connection), the phone page reloading, and set-up messages from older attempts arriving late. A real phone's camera has also been seen on the TV (before the skeleton was added); a full real-phone workout with the skeleton is still to be run.

**End to end without exercising.** The camera page's `?src=<video url>` plays a recorded clip instead of the camera through the *same* pipeline (pose model, rep engine, video link). A headless Chrome on a computer ran it with the openly licensed *Squat – exercise demonstration video* (Wikimedia Commons, CC BY 3.0, 1280×720), and the TV was driven through the real flow: Home → Start coaching → Pair → Start workout.

- The Pair screen switches from the floor plan to the live picture once it arrives, so the user sees themselves while getting into frame.
- The skeleton stays on the body through the squat (checked on frames at the top, on the way down, at the bottom and on the way up). It is mapped straight onto the displayed video and mirrored with it for a front camera.
- A full 3 × 12 workout ran to the receipt (36 reps, all counted).

**Smoothness.** Pose points first came over AppSync (~12 a second) and the skeleton was redrawn by React on each one. They now come over a WebRTC data channel on the same connection as the video (unordered, never resent, one per video frame — ~20 a second), each held back 80 ms so it lands with its video frame (the picture also passes the phone's encoder, a ~15 ms jitter buffer and ~90 ms of hardware decoding on the stick). The bones are native-animated views, so a new pose changes transforms without a React render. Live screen, same test:

| | Redraw per pose | Native-animated skeleton |
|---|---|---|
| Pose updates | ~12/s | ~20/s |
| Frames over 16 ms | 57% | 43% |
| Frame time median / p90 / p99 | 18 / 29 / 38 ms | 16 / 21 / 29 ms |
| App memory | 145–161 MB | 138–140 MB |
| App CPU (of 4 cores = 400%) | ~103% | ~80–97% |

Not yet measured: glass-to-glass latency (an adb screenshot takes about a second, too slow to time it; the stream's own stats put it around 150–200 ms), and a real phone running the pose model and the video encoder at the same time for a whole workout.

## 6. The "Studio" redesign (2026-10-16)

The TV app moved from the paper "Training Notebook" look to a dark "Studio" look (Archivo type, one orange accent), chosen from three mocked-up directions. Only the look changed: every screen keeps its flow, focus order and remote keys. The 3D trainer clips were re-rendered on the panel colour (`tools/trainer/style.py`) so they sit seamlessly in the dark panels, and the app icon, TV banner, splash and Appstore images were regenerated (`tools/brand`).

Checked on the Android TV emulator (1080p) with `tools/fake-phone.mjs`, screen by screen: Who's training → Add someone (Fire TV keyboard) → Home (trainer preview, carried-over coach advice) → Choose a mode → Pair (QR + code, checklist ticks, focus jumps to Start workout) → coached session: warm-up (trainer clip) → squats on the Live screen (count, segments, clean / with a note / no rep, coach card, outline fallback) → rest between sets → later moves ended early with "Done with this" → Paused overlay → receipt (stats, coach's note, every attempt by set). Then Follow along (beat count, rest with the trainer at ease and an "Up next" card, progress across the six moves) → Follow along done, Swap a move (cycle an option, "Put everything back"), and Progress (calendar, clean-form bars). Screenshots: `docs/screenshots/studio/`.

Not checked on the emulator: live phone video (the emulator's network can't receive it); that needs the stick.

**On the Fire TV Stick (same day).** Installed over the earlier build: the stick's history and swaps moved into the "Me" profile on first launch (cold start 4.4 s). Coached session with the phone page from GitHub Pages playing a recorded squat clip as its camera: pairing, live video with the skeleton on the body, warm-up trainer clip, three sets of sumo squats counted and spoken (Polly clips play through expo-audio), rest, then the TV switched the phone to split squats and a plain squat got an honest "No rep" with its reason. One process the whole time, no crash or low-memory kill.

| Live screen with video, 60 s | Before the redesign (§5) | Studio |
|---|---|---|
| Frames over 16 ms | 43% | 60% |
| Frame time median / p90 / p99 | 16 / 21 / 29 ms | 18 / 25 / 40 ms |
| App memory (PSS) | 138–140 MB | 183–201 MB |
| App CPU (of 400%) | ~80–97% | ~125% |
| Free memory on the stick | — | ~245–250 MB |

The Studio Live screen gives the video a much larger panel, which costs some smoothness and about 50 MB; it stayed stable with ~245 MB free. Follow along (trainer video): 1.7% of frames over 16 ms, median 11 ms.

## 7. Phone and TV side by side (2026-10-16)

The phone and the TV used to drift apart (the phone counting squats on the pairing screen, the phone showing 24 while the TV showed 4), so both are now tested together. A watcher (Node, using the app's own AppSync client) subscribes to the session and logs, with timestamps, every phone→TV message, every TV→phone message and the WebRTC set-up, and reads the phone page's screen (status, count, coach line) over Chrome DevTools twice a second. The phone is the camera page in headless Chrome playing a recorded squat clip; the TV is driven and photographed over ADB. A checker then flags any rep the phone sent outside a TV set, and any moment the phone's count differed from the TV's for more than 1.5 s.

On a **Fire TV Stick 4K (AFTMA08C15, Fire OS 8.1.8.2, Android 11, 32-bit, 1.7 GB)**:

| | Before | After |
|---|---|---|
| Reps the phone sent outside a TV set | 55 of 55 | 0 of 45 |
| Phone count vs TV count | phone 24, TV 4 (running total vs per set) | equal, the phone a ~0.2 s behind |
| Start | press "Start camera" on the phone, then "Start workout" on the TV | starts by itself after a 5 s countdown once the phone sees you |
| First thing in a camera session | 40 s warm-up with the trainer video | squats, with your live picture |

Also checked: rest countdowns tick in step on both screens; pause on the remote shows "Paused on your TV" on the phone within ~30 ms and no reps are sent while paused; moving from squats to lunges switches the phone's judging the moment the TV starts the move (a squat then gets "Step one foot forward — that was a squat, this set is lunges"); a phone that reloads mid-set relinks, shows the TV's count again within 1.4 s and its video reconnects within 0.5 s; finishing (or leaving) the session shows "Session done" on the phone. Bugs found and fixed are in `docs/BUGS.md`.

## Known limits

- **Pure side-on filming** can't tell a lunge from a squat when one leg hides the other. Mitigation: 45° placement in the setup flow, plus a live "turn the phone" hint.
- Very low light and loose clothing reduce pose accuracy (MediaPipe limitation).
- **Live video needs the phone and TV on the same network.** There is no relay server (so the video never touches the cloud); Wi-Fi that stops devices from seeing each other, such as many office and guest networks, blocks it. The TV then shows the drawn outline instead, and reps still count.

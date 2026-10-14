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

## Known limits

- **Pure side-on filming** can't tell a lunge from a squat when one leg hides the other. Mitigation: 45° placement in the setup flow, plus a live "turn the phone" hint.
- Very low light and loose clothing reduce pose accuracy (MediaPipe limitation).

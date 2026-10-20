# How RepCast's rep counting is tested

RepCast has to be an **honest coach**: count good reps, say plainly when a rep doesn't count and why, and never count things that aren't the exercise. It is tested at three levels.

## 1. Unit tests (`repcast-movement`, 29 tests)

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

`apps/camera/replay.html` runs a recorded video through **the exact pipeline the phone uses** — MediaPipe Pose Landmarker (lite) and the `repcast-movement` engine — stepping frame by frame at the phone's frame rate (≈15 fps), and reports every verdict plus a per-frame trace of the engine's internal measurements.

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

The phone and the TV used to drift apart (the phone counting squats on the pairing screen, the phone showing 24 while the TV showed 4), so both are now tested together. A watcher (Node, using the app's own AppSync client) subscribes to the session and logs, with timestamps, every phone→TV message, every TV→phone message and the WebRTC set-up, and reads the phone page's screen (status, count, coach line) over Chrome DevTools twice a second. The phone's part is played by the camera page in headless Chrome playing a recorded squat clip; the TV is driven and photographed over ADB. A checker then flags any rep the phone sent outside a TV set, and any moment the phone's count differed from the TV's for more than 1.5 s.

On a **Fire TV Stick 4K (AFTMA08C15, Fire OS 8.1.8.2, Android 11, 32-bit, 1.7 GB)**:

| | Before | After |
|---|---|---|
| Reps the phone sent outside a TV set | 55 of 55 | 0 of 45 |
| Phone count vs TV count | phone 24, TV 4 (running total vs per set) | equal, the phone a ~0.2 s behind |
| Start | press "Start camera" on the phone, then "Start workout" on the TV | starts by itself after a 5 s countdown once the phone sees you |
| First thing in a camera session | 40 s warm-up with the trainer video | squats, with your live picture |

Also checked: rest countdowns tick in step on both screens; pause on the remote shows "Paused on your TV" on the phone within ~30 ms and no reps are sent while paused; moving from squats to lunges switches the phone's judging the moment the TV starts the move (a squat then gets "Step one foot forward — that was a squat, this set is lunges"); a phone that reloads mid-set relinks, shows the TV's count again within 1.4 s and its video reconnects within 0.5 s; finishing (or leaving) the session shows "Session done" on the phone. Bugs found and fixed are in `docs/BUGS.md`.

## 8. One move at a time (2026-10-17)

From the user's emulator test: Home lost its fixed "Legs, gently" session, the Swap screen and the warm-ups. The flow is now Home **Start** → **Coach me on camera** or **Follow along** → **Pick a move** (sections: squats, lunges, jumping jacks, push-ups, glutes & calves, planks; "easier" versions marked) → the move → receipt with **Another move**. Every screen that can go back has an on-screen Back button as well as the remote's BACK.

Checked on the Android TV emulator with the remote keys only, and a headless Chrome "phone" (the camera page from the dev server playing the Commons squat clip as its camera, `?code=…&src=…`), reading the phone's screen and the TV→phone messages over the DevTools protocol:

- Follow along: plank → Done with this (13 s held, saved) → Another move → the list opens on Plank → Back home.
- Camera: squats paired, counted down and started by itself; counts on phone and TV matched; Done with this → receipt (9 reps, 9 squares) → Another move → lunges paired with **the same code**, phone already linked, countdown, then an honest "No rep — that was a squat, this set is lunges". Repeated 4 times: the phone showed "Session done" each time.
- Video on the second move: with the link kept open between moves (new), the picture carried over; before that it fell back to the outline (the emulator's network is unreliable for a fresh WebRTC link — check on the stick).
- Back buttons: Who's training (from Home), Modes, Pick a move, Pair — each reachable with the D-pad and returning one screen.

Bugs found and fixed on the way are in `docs/BUGS.md` (#19–#29). Not yet checked: the stick (performance of the new picker, video on the second move over real Wi-Fi), and a real phone.

## 9. Every move from every angle (2026-10-18)

Prompted by the user's phone test: 9 of 9 jumping jacks were rejected as "The camera moved", and lunges facing the phone were called squats. Rather than guess per report, every judged move was replayed from three phone positions.

**Method.** `tools/trainer/views.py` renders each judged move with the 3D trainer from the front (0°), at 45° and side-on (90°), as portrait phone-shaped clips without the outline pass (~12–40 s each, kept in the git-ignored `tools/trainer/views-out/`). The replay bench (`apps/camera/replay.html`) gained `&repeat=N` to loop a one-rep clip, and a `wky` (3D knee gap) column in its trace. `SPOTTER_MOVEMENT_SRC=1` makes the camera dev server use the engine source from the sibling `repcast-movement` checkout (launch config `camera-engine`, port 5174), so engine changes can be replayed before publishing. A headless Chrome runs the bench three tabs at a time and collects `window.spotterResult`. Real footage: Wikimedia Commons clips (CC/public domain) — "Squat - exercise demonstration video" (from behind), "Squat and Frontal Raise" (side), "Strength Training Circuit- Forward Lunge" and "Forward lunge training" (front and side), "Interval Push-ups" (side).

**Found and fixed in repcast-movement (each with a unit test):**

| Problem | Evidence | Fix |
|---|---|---|
| Jumping/step jacks rejected as "camera moved" | User's phone: 0/9 counted | Jacks don't require planted feet |
| Facing the camera, the pose model swaps left/right ankles for a frame → "camera moved" | Trainer squat from the front: 1/5 counted | Each foot matched to the nearer starting foot |
| Side-on with feet hidden, hip sway → "camera moved" (measured against shoulder width ≈ 0 side-on) | Real side-on squats: 3/7 counted | Hip drift measured against torso length |
| Lunges facing the camera called squats | Real lunge facing the camera: knee gap 0.39–0.54 vs cut-off 0.55 | Cut-off 0.3 with both legs visible, 0.45 side-on, and at least 3 lunge frames |
| Half squats never started when straight legs read ~150° (side-on) | Trainer half squat side-on: 0 reps | Start line follows the learned standing line |

**Measurements that set the lunge cut-off.** Knee gap over torso length in frames at the bottom of reps: squats, half and sumo squats (front, 45°, side; trainer and two real clips) stay ≤ 0.3 in 94–100% of frames, median 0.02–0.06, and side-on never exceed 0.45; real lunges exceed 0.3 in ~60% of frames (side-on lunges exceed 0.45 in 44–57%).

**After the fixes:**

| | Front (0°) | 45° | Side (90°) |
|---|---|---|---|
| Squats (trainer) | 5/5 | 5/5 | 5/5 |
| Sumo squats (trainer) | 5/5 | 5/5 | 5/5 |
| Half squats (trainer) | 0 — trainer reads as leaning 30° from the front, never "upright" | 5/5 | 5/5 |
| Jumping jacks, step jacks (trainer) | 4/4, 3/3 | 5/5 | 5/5 |
| Lunges (trainer) | n/a — the trainer's lunge isn't a real lunge from the front | 2/5 (shallow render) | 5/5 |
| Curtsy lunges (trainer) | 0 attempts | 0/5 "step back and across" | 5/5 |
| Push-ups / knee push-ups (trainer) | head-on: not supported | 5/5, 4/5 | 0/1, 0 — the renders don't go low enough |
| Glute bridges (trainer) | head-on: not seen | 2/2 | 4/4 |
| Real squats (behind; side) | | | 2/2; 6/7 (the 7th was shallow, 128°) |
| Real push-ups (side) | | | 6/6, bottoms 43–49° |
| Real lunges (front and side) | | | counted; the squat-like kettlebell pick-up refused |
| Honesty checks | real squats as a lunge set: refused; trainer lunges as a squat set: refused (45°, side) | | |

**Phone ↔ TV, side by side (emulator + headless phone):** "Start anyway" with nobody in view → TV starts, phone switches to "SQUATS · SET 1 OF 3, 0 / 12" within ~1 s and says it can't see the person. "Start now" during the countdown → phone leaves "Starting in 2" for the set within ~0.2 s; counts follow the TV. "Done for today" → phone shows "Session done".

**Still unverified on a real person:** lunges and curtsy lunges facing the camera (one real clip shows a lunge partly facing it), half squats facing the camera, knee push-ups, glute bridges. The trainer renders are not good enough for these; short phone recordings from the user would settle them.

## 10. Fire TV Stick 4K: smoothness, long sessions, every main flow (2026-10-18)

On the Fire TV Stick 4K (AFTMA08C15, Fire OS 8, 32-bit), release build, with the "phone" being headless Chrome on the Mac playing the Commons squat clip through the camera page (dev server), over home Wi-Fi.

**Live screen with video, 60 s.** 1,185 frames (≈ 20 a second, one per skeleton update), 50% over Android's 16 ms mark, median / p90 / p99 16 / 23 / 29 ms; app memory 165–172 MB, app CPU ~130% of 400%, ~450 MB free. Split by stage (median): ~6 ms applying the skeleton's native-driven values on the UI thread, ~7–8 ms issuing draw commands (the whole window redraws per update), GPU ~6 ms. The video itself, measured on its own surface layer (`dumpsys SurfaceFlinger --latency`), ran at ~24 fps with no gap over 100 ms. Because the screen only changes ~20 times a second, a 20–25 ms frame still lands before the next update: the "janky" share is Android's 60 fps yardstick, not visible stutter. Two tweaks were tried and measured (no rounded clip around the video; skipping unchanged opacity values): no measurable difference, so neither was kept. Per thread: JS 21%, UI 14%, RenderThread 15%, WebRTC and decoder threads a few percent each.

**Follow along (trainer video), 30 s:** 0.4% of frames over 16 ms, median 6 ms, 194 MB.

**Flows checked:** a full 3 × 12 camera workout to the receipt (36 counted, phone and TV in step all the way); Pause from the button and Resume from the remote's play/pause (phone shows "Paused on your TV"); "Done with this" after 6 reps (honest short receipt, phone "Session done"); "Another move" → Lunges reusing the pairing and video link (the phone switched within the countdown and refused the clip's squats: "that was a squat, this set is lunges"; TV and phone counted the same no-reps); Follow along; Progress; profile picker; BACK from each.

**Long session:** the first 8-minute hands-off run on the Live screen ended at ~5 minutes when the Fire TV screensaver started (bug #37): RepCast went to the background and the phone said "Lost your TV". With the screen kept on during Pair, camera workouts and Follow along, a second 8-minute hands-off run stayed in the app throughout: same process, app memory 165–185 MB with no upward drift, CPU 80–136%.

Test runs add sessions to the "Me" profile's history on the stick (five on 2026-10-18).

## 11. Telling look-alike moves apart (2026-10-18)

**From a phone test** (the user's Android phone, results in `Live-Phone-Testing/`, outside the repos): full squats counted in a half-squat set; lunges, reverse lunges, split squats and curtsy lunges all counted for each other; real lunges called squats (6 of 17); step jacks counted jumping jacks; jumping jacks never counted (the phone ran at 7 fps); the phone's video froze after the screen went off; the "turn the phone 45°" line repeated; the three lunges shared one trainer clip.

**What the engine does now.** Before each rep it notes where the feet stood (the standing frames with the feet closest together, since people step out before they bend), and at the bottom which foot moved and how far, whether it became the front foot (its knee higher than the other: at the bottom of any lunge the front knee is up and the back knee down, from any angle), whether it crossed behind the other (facing the camera), and in jacks whether one or both feet stepped out. Each move declares the footwork it expects; a clear mismatch is a no-rep that names the move done instead, unclear footwork keeps the benefit of the doubt, and a clear step is never a squat. The knee-height stance guess is only used when the feet can't be seen.

**Evidence.** 71 unit tests (15 new, one per look-alike pair). Replay bench with the phone's pose model:

| Footage | Result |
|---|---|
| Rendered forward lunge, 45° / side-on | as lunge 4/4, 4/4; as split squat, squat 0/4 |
| Rendered reverse lunge, side-on | as reverse lunge 4/4; as lunge, split squat, squat 0/4 |
| Rendered split squat, 45° / side-on | as split squat 4/4, 3/3; as lunge 1/4, 0/3; as squat 0/4 |
| Rendered curtsy, side-on | as curtsy 4/4; as split squat, squat 0/4 (as reverse lunge 4/4: side-on the crossing can't be seen) |
| Rendered jumping jack, front / 45° | as jumping jack 5/5, 6/6; as step jack 0/5, 0/6; at 7 fps 5/5 |
| Rendered step jack, front / 45° | as step jack 3/4, 6/6; as jumping jack 2/4 → 0/6 at 45° |
| Real forward lunges (3 Commons clips) | as lunge 5/7, 4/5, 1/1; as split squat 0/7; as squat 0/8 |
| Real reverse lunges (kettlebell clip) | as reverse lunge 10/12 (was 3/12) |
| Real half-squat demo / real full squats | as half squat 5/6 (was 0/6: four false "that's a lunge") / 0/2 ("that was a full squat") |
| Real jumping jacks at 7 fps | 9/9 |

The renders now use a phone-like camera (perspective, hip height, 2.4 m; `tools/trainer/views.py`): the trainer clips' orthographic camera has no perspective, so a foot stepping towards it doesn't move down the picture. Known limits: the pose model doesn't read the mannequin's knee bend straight from the front (0° renders), so those aren't used for depth; at an angle where a curtsy's step points straight at the camera the step barely shows; side-on, telling a forward from a reverse lunge is often unclear and then isn't judged.

**Phone ↔ TV, side by side** with a fake-camera phone (headless Chrome, `--use-fake-device-for-media-stream`) and the stick: camera track stopped → reopened in ~2 s with the TV picture carrying on; video paused → reopened in ~3.5 s; page shown again → playing in 0.8 s. "Watch trainer" during a lunges set: the clip and cues, the phone shows the pause, BACK returns to the set running. New trainer clips checked on the stick's move picker.

## 12. Phone test round 2 and real gym clips (2026-10-19)

**From the user's phone test** (results in `Copied-Results-and -live-gym-clips/`, outside the repos): "camera moved" with the phone untouched (squats, half squats, every move); squats with half the body in view called lunges and no "step back"; sumo and half squats told "this set is squats"; reverse lunges told "this set is lunges"; split squats 8 of 9 "that was a lunge"; curtsy lunges nearly all "sink lower"; no "come closer" when far. Plus five clips filmed at a gym and an office: two front-on Smith-machine/bodyweight squat sets, two side-on dumbbell split-squat sets (sent as "lunges": the feet stay apart the whole time), one pull-up set (not a RepCast move).

**What the data showed.** Every false "camera moved" and most false "lunge" calls came from reps where *both* feet moved 0.4–0.6 of leg length (the person walked or came nearer), or from feet below the picture: the pose model still places them, with confidence 0.5–0.7. Squats with planted feet were also called lunges at an angle, because "forward" came from the toe direction and turned-out toes made the sideways gap between the feet look like one foot ahead. Side-on, real split squats "step" 0.15–0.63 (heel lift, the hidden ankle) and real lunges 0.15–0.33: the two can't be told apart from the side.

**Changes** (BUGS #49–56): off-picture points count as unseen (engine and phone page); both feet moving = "You moved off your spot", not judged on footwork; toe directions averaged over both feet; squat sets call a lunge only when a foot stepped; split-squat sets no longer call anything a lunge (feet side by side still don't count); each move names its own set in its cues; curtsy depth target 115°, no-rep above 130°; standing moves ask to step back until both feet are in the picture, and to come closer when the torso is under 12% of the picture.

**Evidence.** 72 unit tests (a squat whose guessed feet wander below the picture fails on the old engine). Replay bench, every judged move rendered at 0°, 45° and 90° (3 reps each), Commons clips and the gym clips:

| Footage | Result |
|---|---|
| Gym: friend's squats, front-on (Smith machine) | as squat 5/5; as lunge 0/5 ("that was a squat"); as half squat 2/5 (the rest "that was a full squat") |
| Gym: split squats side-on, two sets | as split squat 5/5 and 3/3 (was 4/5 and 2/3); as squat 0/5 and 1/3 ("that's a lunge"); as lunge or reverse lunge they count too (honest limit, above) |
| Office: squats with the phone close (feet and, at the bottom, knees out of the picture) | 0 reps counted and no false "lunge" (was 1 "lunge"); the phone now asks to step back |
| Rendered squat / half / sumo, 45° and side-on | 3/3 each (sumo at 45° was 0/3 "that's a lunge") |
| Rendered lunge, reverse lunge, split squat, curtsy, 45° and side-on | 3/3, 3/3 (45°), 3/3 and 2/2, 3/3 and 2/3 |
| Rendered push-up, knee push-up, glute bridge, jumping jack, 45° and side-on | 3/3 3/3, 2/3 3/3, 2/2 3/3, 3/3 3/3 |
| Rendered step jack | 45°: 3/3; side-on: 1/3 (a sideways step can't be seen side-on; the phone asks to turn for jacks) |
| Commons squats (3 clips), half squat, push-ups | 2/2, 6/7, 2/2; 4/4; 6/6 |
| Commons forward lunges (2 clips) | 4/5, 5/7 (no-reps: not standing tall, leaning, one squat-like rep) |

0° renders aren't used for knee depth (the pose model misreads the mannequin head-on), so 0/0 there is expected.

**Phone and TV together** (stick with the released APK f83eaa9, headless-Chrome phone on `camera-dev` playing the clips as its camera, 4-digit code 7908): pairing, the 5 s countdown and the phone following the TV's set all worked; the friend's gym squats came through as live video with the skeleton aligned and counted 6/6 on both the phone and the TV, all clean, with voice. With the office clip (feet out of the picture) nothing was counted, no false "lunge" or "moved", and the TV said "Step back a little, so I can see all of you." three times, 15 s apart (logcat: three plays of exactly the clip's 2.856 s). The hint is spoken only; the TV's coach card doesn't show it.

## 13. Analysis dashboard, year calendar, no-video fallback (2026-10-19)

On the Fire TV Stick 4K with the release APK, phone = `tools/fake-phone.mjs` (no video) and the camera page in headless Chrome playing the Commons squat demo (with video):

- **Progress:** the year grid draws 53 weeks × 7 days (371 plain Views) with month labels, today ringed and four orange levels by the person's own quartiles; streak tiles, clean-form trend and the moves bar underneath.
- **No video:** with the fake phone (which sends no video) the Live panel switches after 6 s to the move's trainer clip, the "No live picture — same Wi-Fi" notice and the drawn outline of the person in a corner; during rests the trainer stands at ease. Reps kept counting. With the clip phone, live video showed as before.
- **Analysis:** tiles (counted vs planned, clean %, deepest knee angle, seconds per rep, time, change since last time), a bar per attempt by set, the form breakdown with what the camera flagged, and the trend over earlier sessions all appear at once, before the AI answers; Amazon Nova's note arrived in ~10 s. The model once claimed "first session on record" with earlier sessions in the request, so the comparison line is now stated by the TV from the numbers and the model's headline isn't shown; only the coach's note and the next-session plan are the model's.
- Test workouts added to the "Me" history today: 19:04 (24 reps), ~19:08 (12) and ~19:11 (12).

## Known limits

- **Pure side-on filming** can't tell a lunge from a squat when one leg hides the other, nor a split squat from a lunge (heel lift and the hidden ankle look like a step). Mitigation: 45° placement in the setup flow, plus a live "turn the phone" hint.
- Very low light and loose clothing reduce pose accuracy (MediaPipe limitation).
- **Live video needs the phone and TV on the same network.** There is no relay server (so the video never touches the cloud); Wi-Fi that stops devices from seeing each other, such as many office and guest networks, blocks it. The TV then shows the drawn outline instead, and reps still count.

# Bug log

Found by testing the phone and the TV side by side: a watcher listens to every message between them and reads the phone page's screen twice a second, while the TV is driven and photographed over ADB (see TESTING.md §7). Phone = the camera page playing a recorded squat clip as its camera; TV = Fire TV Stick 4K (AFTMA08C15, Fire OS 8.1.8.2) unless noted.

Status: **fixed** (2026-10-16, verified on the stick), **decided** (a product call), or **open**.

## Phone and TV out of step

| # | What happened | Evidence | Cause | Fix | Status |
|---|---|---|---|---|---|
| 1 | The phone counted squats while the TV was still on the pairing screen | Phone reached 12 reps before "Start workout"; the TV had sent the phone nothing | The phone judged squats by default as soon as it linked | Linked to a TV, the phone judges only while the TV says a set is on | fixed |
| 2 | Phone and TV showed different counts (phone 24, TV 4 at the same moment) | Side-by-side capture, set 2 of squats | The phone showed its own running total across sets and counted through rests and pauses; the TV counts per set | The TV is the one source of truth: it sends its count, set and phase, and the phone shows the TV's count | fixed — 45 reps, 0 sent outside a set, counts equal within ~0.2 s |
| 3 | The phone didn't know about sets, rests, pauses or the end | Only `{type:'exercise', id}` went TV → phone | — | The TV→phone message now carries `phase` (pair, countdown, work, rest, paused, done), set, count, target, seconds left and the next move | fixed |
| 4 | A phone that joined late judged the wrong thing for up to 4 s | 4 s heartbeat | — | Heartbeat every 2 s | fixed |
| 5 | After the TV left a session the phone carried on judging | No timeout | — | The TV says "done" when a session ends or is left; any other 8 s of silence shows "Lost your TV" and stops judging | fixed |
| 6 | "Ready" flickered about every 3 s during squats, so the Start button and focus jumped | `framing.ready` alternating | Knees drop out of view at the bottom of a squat; `ready` wasn't steadied | `ready` must hold 1.2 s before it changes either way | fixed |
| 7 | Nothing started by itself: scan, press "Start camera", then press "Start workout" | Pairing flow | Both steps needed a button press | Opened from the QR code, the phone starts its camera by itself; once it can see you the TV counts down from 5 and starts ("Start now" skips; stepping out of view cancels) | fixed (TV countdown verified; the phone camera starting by itself is not yet checked on a real phone) |
| 14 | The countdown's first message said "Starting in 34" for a moment | Watcher log | The countdown clock only ticked while counting, so it was stale from when the screen opened | Bring the clock up to date when the countdown starts | fixed |
| 15 | 8 s after a finished session the phone switched from "Session done" to "Lost your TV" | Watcher log | The silence timeout also applied after "done" | A finished session stays finished | fixed |

## Camera session

| # | What happened | Fix | Status |
|---|---|---|---|
| 8 | A camera session opened with a 40 s warm-up that played the 3D trainer and hid the camera | Camera sessions run only the moves the camera checks (squats, lunges, jumping jacks), each with your live picture; no trainer video while the phone streams | fixed |
| 9 | Warm-ups made a demo slow: 40 s before the first squat | Camera sessions skip warm-ups and stretches; Follow along keeps its warm-up (skippable with "Done with this"). The Modes screen says what each runs ("Squats, lunges and jumping jacks · about 7 min") | decided |
| 10 | The phone spoke counts as well as the TV | The phone's voice and its "Count out loud" option are gone; the TV speaks | fixed |

## Receipt and Home

| # | What happened | Fix | Status |
|---|---|---|---|
| 11 | A fresh install's Home said "0 days in a row · best run 0" | "Your first session starts your streak" (or "Start a new streak today · best run N") | fixed |
| 16 | "100%" wrapped onto two lines in the receipt's tile | Smaller number, wider column | fixed |
| 17 | After a session ended early the coach's note said "we add a set — 4 × 12" | A session stopped well short of the plan gets "Next time: the whole session, every set — slower is fine" | fixed |
| 18 | A 3-rep session was headlined "That was a good one." | Under half the planned reps: "A short one. It still counts." | fixed |

## Look and website

| # | What happened | Fix | Status |
|---|---|---|---|
| 12 | The app icon and TV banner looked cheap (a sketched tally mark) | New mark: an orange tile with a figure mid-squat inside a rep ring; new icon, TV banner ("Your TV checks every rep"), splash, Appstore images and website icons (`tools/brand`) | fixed |
| 13 | The website didn't say what RepCast is at first glance | New hero: "A workout app for Amazon Fire TV — Work out at home. Your TV checks every rep", what it does in one sentence, and what you need (a Fire TV, your phone, 2 m of floor) | fixed |

## Emulator test by the user (2026-10-17) and what testing it turned up

| # | What happened | Fix | Status |
|---|---|---|---|
| 19 | Most screens had no on-screen way back; only the remote's BACK key | A Back button (with a chevron) on Modes, Pick a move, Pair and Who's training (when opened from Home); Progress already had one | fixed |
| 20 | "Legs, gently" as the Home title made no sense; its subtitle described a warm-up | No fixed session any more: Home says "Let's move." with one Start button and "Your progress"; you pick the move | decided |
| 21 | Warm-ups (march on the spot and 8 others) | Removed from the app, with their trainer clips (APK 1 MB smaller) | decided |
| 22 | Too many buttons on Home (Start, Follow along, Swap a move); swapping was hidden behind pressing OK to cycle | Start → choose the mode → Pick a move, every move on its own card in sections, "easier" ones marked. The Swap screen and "Put everything back" are gone | decided |
| 23 | "Progress" was an underlined text link that didn't look like a button | "Your progress", a real button next to Start | fixed |
| 24 | The receipt drew 9 attempts but said 1 rep | A rep landing in the moment after "Done with this" was added to the live list the receipt was drawing from; the receipt now gets its own copy | fixed |
| 25 | After a move, the phone sometimes said "Lost your TV" instead of "Session done" (1 in 5) | The TV sent "done" and closed its connection straight away; it now says it twice and closes 2 s later (4 of 4 delivered after) | fixed |
| 26 | On the second move the live picture didn't come back (the TV showed the outline) | The video link is kept open while you pick the next move, so it carries over | fixed on the emulator; check on the stick |
| 27 | On Pick a move, UP from the top row couldn't reach Back | The list no longer scrolls (all six sections fit), so the D-pad moves out of it normally | fixed |
| 28 | A move ended before any attempt still went into the history and streak | Not saved; the receipt still shows | fixed |
| 29 | "Last time, Friday: 1 reps" | "1 rep" | fixed |

## Every move from every angle (2026-10-18)

| # | What happened | Fix | Status |
|---|---|---|---|
| 30 | Every jumping jack was rejected: "The camera moved — keep the phone still" (user's phone: 0/9) | The engine assumed planted feet; jacks jump them apart. Jacks no longer require planted feet | fixed (engine a984e28) |
| 31 | Facing the camera, squats were rejected as "camera moved" | The pose model swaps left and right ankles for a frame; feet are matched regardless of label | fixed |
| 32 | Side-on squats with the feet out of view: "camera moved" (real clip 3/7) | Hip drift measured against torso length, not shoulder width (≈ 0 side-on) — now 6/7, the 7th genuinely shallow | fixed |
| 33 | Lunges facing the camera were called squats ("Step one foot forward — that was a squat") | Lunge cut-off 0.3 when both legs are visible (0.45 side-on, ≥ 3 frames), from measured squat and lunge knee gaps | fixed; front-view lunges not yet checked on a real person |
| 34 | Half squats never counted side-on (straight legs read ~150°) | The start-of-rep line follows the person's own standing line | fixed |
| 35 | Curtsy lunges at 45° rejected ("step back and across") on the trainer render | Not changed: the render is shallow and there is no real footage | open — needs a real clip |
| 36 | "Start anyway" / "Start now" and phone sync | Checked side by side: the phone follows within 0.2–1 s | works |
| 37 | Fire TV screensaver started mid-workout (~5 min after the last remote press): RepCast went to the background, the video and session dropped, the phone said "Lost your TV" | Pair, camera workout and Follow along keep the screen on (`expo-keep-awake`, already in the APK via Expo); other screens still allow the screensaver. Checked: 8 min hands-off on the Live screen, no screensaver | fixed |
| 38 | Progress said "up from 100% to 100%" when clean form hadn't changed | Says "steady at 100%" when first and latest are equal | fixed |
| 39 | Phone test: after the phone's screen went off, the TV kept the last picture and the phone page never came back to life until reloaded | The page re-takes the screen wake lock whenever the system drops it (it never noticed before, so the phone could sleep mid-workout), restarts a paused video or a stopped camera when it is shown again, and a watchdog reopens a camera whose track ended, stayed muted or stopped giving frames for 2.5 s (the video's clock keeps running on a dead camera, so frame times alone missed it). Checked with a fake-camera phone against the stick: stopped camera → new camera in ~2 s, paused video → reopened in ~3.5 s, page shown again → playing in 0.8 s; the TV picture carried on without re-pairing | fixed |
| 40 | Phone test: full squats (51–55°) counted in a half-squat set | Half squats refuse reps under 66° ("That was a full squat — this set is half squats"); real half squats measured 72–137°, real full squats 39–60° | fixed |
| 41 | Phone test: lunges and reverse lunges counted for each other; normal lunges counted in split-squat and curtsy sets | The engine follows the feet (which foot moved, whether it became the front foot, whether it crossed behind) and each move says what it expects; see TESTING §11 | fixed; forward vs reverse is only judged when clear (side-on often isn't) |
| 42 | Phone test: real lunges called "that was a squat" (6 of 17) | A foot that clearly stepped is a lunge, whatever the knee heights say; the knee-gap guess is only used when the feet can't be seen. Real reverse-lunge clip: 3/12 → 10/12 counted | fixed |
| 43 | Phone test: "turn the phone 45°" said repeatedly during lunges | Only asked for moves that need a view across the body (squats, sumo, jacks, curtsy); forward/reverse lunges and split squats are judged from the side too. The TV says it once | fixed |
| 44 | Phone test: lunge, reverse lunge and split squat showed the same trainer clip (a split squat) | New stepping clips for lunge (step forward), reverse lunge (step back) and curtsy (back and across); the old one is the split squat's | fixed |
| 45 | Phone test: step jacks counted jumping jacks and arm-only sweeps | Step jacks need one foot out, jumping jacks both (sideways movement facing the camera, how far each foot moved at an angle) | fixed |
| 46 | Phone test: no way to see how a move goes without leaving the workout | "Watch trainer" next to Pause: the move's clip and cues, the set paused; BACK or "Back to my set" returns | added |
| 47 | Phone test: jumping jacks never counted on a phone running at 7 fps | The smoothing was per frame (tuned at 15 fps) and lagged behind fast moves; it now speeds up for slower frames. Rendered jacks at 7 fps: 5/5 and 6/6 | fixed |
| 48 | The phone page ran MediaPipe on a 1280×720 capture | Asks for 960×540: MediaPipe works on a 256-pixel copy and the TV gets 480p at most; results now say whether the model runs on the GPU or CPU | changed |

## Phone test round 2 and gym clips (2026-10-19)

| # | What happened | Fix | Status |
|---|---|---|---|
| 49 | Squats with half the body in view (phone close, feet cut off): "camera moved" and "that was a lunge"; the phone never said to step back | The pose model also guesses feet below the picture, with confidence 0.5–0.7. The engine and the phone page now treat any point outside the picture as unseen, so off-picture feet judge nothing. The user's office squat clip: wrong "lunge" no-reps 1 → 0 | fixed |
| 50 | "The camera moved" when the phone hadn't moved (squats, half squats, every move) | Both feet moving means the person moved (walking about, coming nearer): the cue now says "You moved off your spot — stay in one place for each rep, and keep the phone still", and such reps aren't judged on footwork | fixed |
| 51 | Ordinary squats, feet planted, called "That's a lunge" (trainer at 0°, sumo at 0° and 45°) | Which way is "forward" came from the toes; turned-out toes made the sideways gap between the feet read as one foot in front of the other. Both feet's directions are now averaged | fixed |
| 52 | Sumo squats / half squats: "this set is squats"; reverse lunges: "this set is lunges" | Each squat-style move names its own set ("this set is sumo squats, feet wide"); reverse lunges say "reverse lunges" | fixed |
| 53 | Curtsy lunges: nearly every rep "sink lower" (phone bottoms 88–121°) | Curtsy depth target 115°, no-rep above 130° (the crossed back leg keeps the front knee less bent than a lunge) | fixed |
| 54 | Split squats: 8 of 9 reps "that was a lunge" (phone), 3 of 8 in the gym clips | Side-on, a split squat's heel lift and the hidden ankle read as steps of 0.15–0.63, overlapping real lunges (0.15–0.33). A split-squat set no longer calls anything a lunge; feet side by side still don't count. Depth and form are judged as before | changed (honest limit) |
| 55 | No "step back" / "come closer" during a set | Standing moves ask to step back until both feet are in the picture; "come closer" when the torso is under 12% of the picture (was 10%). The TV says them during sets: "Step back a little, so I can see all of you." / "Come a little closer to the phone." | fixed |
| 56 | Pairing code 6 digits felt slow to type | Back to 4 digits; the code lookup route is limited to 2 requests a second, so trying every code takes over 80 minutes (codes live 2 hours). 6-digit codes still accepted | fixed (backend) |

## Not ours

- Fire OS shows "Allow USB debugging?" over a running app when a computer connects without "Always allow"; while it is up the app's timers stall (a rest took 74 s instead of 60). The phone correctly showed "Lost your TV" and recovered when the dialog closed.

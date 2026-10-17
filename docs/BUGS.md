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
| 13 | The website didn't say what Spotter is at first glance | New hero: "A workout app for Amazon Fire TV — Work out at home. Your TV checks every rep", what it does in one sentence, and what you need (a Fire TV, your phone, 2 m of floor) | fixed |

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

## Not ours

- Fire OS shows "Allow USB debugging?" over a running app when a computer connects without "Always allow"; while it is up the app's timers stall (a rest took 74 s instead of 60). The phone correctly showed "Lost your TV" and recovered when the dialog closed.

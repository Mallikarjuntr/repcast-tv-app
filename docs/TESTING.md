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

A scripted "virtual athlete" publishes pose and rep events to a real pairing session over AppSync Events, while the Fire TV app runs on the Android TV emulator; screenshots of each state are in `docs/screenshots/`.

## Known limits

- **Pure side-on filming** can't tell a lunge from a squat when one leg hides the other. Mitigation: 45° placement in the setup flow, plus a live "turn the phone" hint.
- Very low light and loose clothing reduce pose accuracy (MediaPipe limitation).

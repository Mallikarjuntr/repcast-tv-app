# Open Source mini challenge — submission fields (draft)

Paste into the Devpost form's Open Source section.

**Contribution URL:** https://github.com/Mallikarjuntr/spotter-movement/commits/main

**Repo URL:** https://github.com/Mallikarjuntr/spotter-movement

**GitHub username:** Mallikarjuntr

**License:** MIT (LICENSE file in the repo; shown in the GitHub About sidebar)

**Description (what, how, why):**

spotter-movement is a new open-source TypeScript library, started on 13 Oct 2026 for this hackathon, that turns body pose landmarks (such as MediaPipe Pose's 33 points) into counted reps, timed holds and plain-language form feedback. It is the brain of Spotter, the Fire TV coach, and works in any browser or JavaScript app with no network calls or dependencies.

How it works: every exercise is plain data built on two primitives. A rep detector follows one joint angle through a rep (knee for squats, elbow for push-ups, shoulder for jumping jacks), and a hold detector checks a pose stays within tolerances (plank, tree pose). On each rep it gives an honest verdict, good, fix or no-rep, with the reason in words a coach would say ("Not deep enough — that one doesn't count"). Built-in gates stop false reps: reps start only from standing (or lying, for floor moves), feet that should stay planted must stay planted, and look-alike moves are told apart by what the feet did, so a lunge doesn't count in a squat set, a reverse lunge isn't a forward lunge, and a jumping jack isn't a step jack. It ships 14 exercises (squat, half and sumo squat, four lunges, two jacks, push-ups, knee push-ups, glute bridge, plank, tree pose), and new ones need no code.

Why it matters: rep counters usually either count everything or need special hardware. This one runs on any phone's camera, is honest about reps that don't count, and was tested the way people really use it: on real recordings and on a rendered 3D trainer seen from the front, at 45° and side-on, which found and fixed real problems (phones at 7 fps missing jumping jacks, ankle labels swapping when facing the camera). 71 unit tests, MIT licensed, so anyone can build a home-fitness, physiotherapy or accessibility app on it.

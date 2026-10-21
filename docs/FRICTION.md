# Friction log

Problems hit while building RepCast, logged as they happened. Each entry: the task, the steps, what was expected and what happened, how bad it was, the workaround and a suggestion.

| # | Date | Area | Problem | Severity |
|---|---|---|---|---|
| [1](#1) | 2026-10-13 | AWS CloudShell | CloudShell won't open: "account verification is in progress" | Medium |
| [2](#2) | 2026-10-13 | Amazon Bedrock | Bedrock Anthropic use-case form refused without a reason | High |
| [3](#3) | 2026-10-13 | AWS Support | No clear confirmation that a Support case was opened | Low |
| [4](#4) | 2026-10-13 | npm (tooling) | npm warns about install scripts for a git dependency that built fine | Low |
| [5](#5) | 2026-10-13 | AWS IAM + GitHub OIDC | GitHub OIDC role refused: the token's subject format changed | High |
| [6](#6) | 2026-10-13 | react-native-tvos (used by Amazon's multi-TV sample) | Pressable's `focused` state missing from the TV TypeScript types | Low |
| [7](#7) | 2026-10-13 | react-native-tvos on Fire OS / Android TV | Remote keys never reach a screen with nothing focusable | Medium |
| [8](#8) | 2026-10-14 | react-native-tvos + npm workspaces | `expo install` pulls in stock React Native next to react-native-tvos | High |
| [9](#9) | 2026-10-14 | Fire TV Stick (3rd gen) + React Native | A 64-bit-only APK won't install on a 64-bit CPU stick | High |
| [10](#10) | 2026-10-14 | Fire TV text-to-speech (Fire OS 7.7, Fire TV Stick 3rd gen) | Fire TV text-to-speech is silent for apps, with no error | High |
| [11](#11) | 2026-10-15 | Fire TV (Fire OS 7.7) + ADB | `adb am start` leaves the screensaver on top | Low |
| [12](#12) | 2026-10-15 | react-native-webrtc 124 on Fire TV | `RTCView` stays black when the track arrives without a stream | Medium |
| [13](#13) | 2026-10-15 | AWS AppSync Events | AppSync Events delivers a client's own events back to it | Low |
| [14](#14) | 2026-10-15 | React Native (new architecture) on Fire TV Stick 3rd gen | Re-rendering a live skeleton in React saturates the stick's CPU | Medium |
| [15](#15) | 2026-10-17 | React Native release build (Gradle, Expo) | Deleted assets stay in the release APK | Low |
| [16](#16) | 2026-10-17 | react-native-tvos on Android TV | D-pad focus can't leave a `ScrollView` for a button above it | Medium |
| [17](#17) | 2026-10-18 | MediaPipe Pose (pose_landmarker_lite, web) | MediaPipe swaps left and right ankles facing the camera | Medium |
| [18](#18) | 2026-10-18 | Amazon Bedrock (Converse, ap-south-1) | Bedrock "Operation not allowed" with no reason (account verification) | High |
| [19](#19) | 2026-10-18 | Amazon Bedrock (IAM, cross-account keys) | Bedrock's two APIs need different IAM actions | Medium |
| [20](#20) | 2026-10-19 | Amazon Bedrock (third-party models) | Claude on Bedrock needs AWS Marketplace permissions on first call | Medium |
| [21](#21) | 2026-10-19 | Amazon Polly (neural, ap-south-1) | Polly neural voices throttle a 4-way parallel recording job | Medium |
| [22](#22) | 2026-10-21 | Fire TV launcher (Fire OS 8) | Home screen keeps a sideloaded app's first name and icon after updates | Medium |

## 1
**CloudShell won't open: "account verification is in progress"** · AWS CloudShell · 2026-10-13

- **Task:** Open CloudShell (ap-south-1) to deploy a bootstrap CloudFormation stack
- **Steps:**
  1. Sign in to the AWS console as an admin, region ap-south-1 (Mumbai).
  2. Click the CloudShell icon in the top bar.
  3. Wait for the environment to be created.
- **Expected:** Shell opens with console credentials
- **Actual:** "Unable to create the environment. Your account verification is in progress" on an account opened 5+ weeks earlier, with no other sign of pending verification in the console
- **Severity:** Medium
- **Workaround:** Deployed the stack through the CloudFormation console upload instead
- **Suggestion:** Show verification status (and what's pending) on the account/billing pages, not only inside CloudShell

## 2
**Bedrock Anthropic use-case form refused without a reason** · Amazon Bedrock · 2026-10-13

- **Task:** Submit the Anthropic use-case form (ap-south-1) to enable Claude models
- **Steps:**
  1. Open the Bedrock console in ap-south-1 → Model access.
  2. Pick an Anthropic model and fill in every field of the use-case form.
  3. Submit.
- **Expected:** Form submits, model access granted
- **Actual:** "Your account is not authorized to perform this action. Please create a support case" after filling in every field
- **Severity:** High (blocks the AI coach)
- **Workaround:** Opened an AWS Support case; AI coach built behind a model switch so another provider can be used meanwhile
- **Suggestion:** Check eligibility before showing the form, and name the specific reason (e.g. pending account verification) in the error

## 3
**No clear confirmation that a Support case was opened** · AWS Support · 2026-10-13

- **Task:** Create a case for the above
- **Steps:**
  1. Open Support Center → Create case.
  2. Describe the Bedrock error in the chat box that appears.
  3. Look for a case ID.
- **Expected:** A category or form to pick
- **Actual:** An AI chat box is the entry point; unclear whether an account case was actually opened
- **Severity:** Low
- **Workaround:** Described the issue in full in the chat box
- **Suggestion:** Show a clear "case created, ID …" confirmation

## 4
**npm warns about install scripts for a git dependency that built fine** · npm (tooling) · 2026-10-13

- **Task:** Install a GitHub-hosted TypeScript package that builds in `prepare`
- **Steps:**
  1. Use npm 11.
  2. `npm install github:OWNER/repo#branch` for a TypeScript package that builds in its `prepare` script.
  3. Read the install output.
- **Expected:** Silent install
- **Actual:** npm 11 prints an install-scripts approval warning for git dependencies even though the build ran
- **Severity:** Low
- **Workaround:** None needed: the package had built
- **Suggestion:** Don't warn when a git dependency's only script is `prepare` and it ran; or name the package and link to how to approve it

## 5
**GitHub OIDC role refused: the token's subject format changed** · AWS IAM + GitHub OIDC · 2026-10-13

- **Task:** GitHub Actions assumes a deploy role whose trust policy uses the documented `repo:OWNER/REPO:ref:refs/heads/main` subject
- **Steps:**
  1. Create an IAM role that trusts `token.actions.githubusercontent.com` with the subject from the AWS docs: `repo:OWNER/REPO:ref:refs/heads/main`.
  2. Run a workflow that uses `aws-actions/configure-aws-credentials` with that role.
- **Expected:** Role assumed
- **Actual:** "Not authorized to perform sts:AssumeRoleWithWebIdentity", with no hint which claim failed. GitHub now sends an ID-qualified subject: `repo:OWNER@ownerId/REPO@repoId:ref:...`
- **Severity:** High (blocked all deploys)
- **Workaround:** Printed the token's `sub` as a run annotation, then updated the trust policy to the new format
- **Suggestion:** Name the mismatched claim (and the received value) in the STS error; update the AWS GitHub-OIDC docs and console role wizard for the ID-qualified subject

## 6
**Pressable's `focused` state missing from the TV TypeScript types** · react-native-tvos (used by Amazon's multi-TV sample) · 2026-10-13

- **Task:** Style a focused button on Fire OS via Pressable's `({ focused })` callback
- **Steps:**
  1. In a react-native-tvos app with strict TypeScript, write `<Pressable style={({ focused }) => …}>`.
  2. Run `tsc --noEmit`.
- **Expected:** `focused` typed on `PressableStateCallbackType`
- **Actual:** Works at runtime, but the TV type augmentation doesn't merge into the public Pressable types, so TypeScript rejects `focused`
- **Severity:** Low
- **Workaround:** Small typed `isFocused(state)` helper
- **Suggestion:** Ship merged TV typings, or document the helper pattern in the Fire TV React Native docs

## 7
**Remote keys never reach a screen with nothing focusable** · react-native-tvos on Fire OS / Android TV · 2026-10-13

- **Task:** Pause a workout with the remote's Play/Pause key via `useTVEventHandler` on a screen with no buttons
- **Steps:**
  1. Build a screen with no focusable views and register `useTVEventHandler`.
  2. Press Play/Pause on the Fire TV remote.
  3. Log the events received.
- **Expected:** The handler fires
- **Actual:** Nothing arrives: Android only delivers key events down the focus chain, so a screen without a focusable view never receives remote keys. Each press also fires twice (key down and up)
- **Severity:** Medium
- **Workaround:** Added a focused "Pause" button (OK also pauses) and act only on key-up
- **Suggestion:** Document the focus requirement and the down/up pair in the TV event docs; consider dispatching remote keys even when nothing is focused

## 8
**`expo install` pulls in stock React Native next to react-native-tvos** · react-native-tvos + npm workspaces · 2026-10-14

- **Task:** `npx expo install @react-native-async-storage/async-storage` in a react-native-tvos app
- **Steps:**
  1. npm workspaces monorepo; root `react-native` resolves to react-native-tvos 0.86.
  2. Run `npx expo install @react-native-async-storage/async-storage` in the TV app.
  3. Build: `./gradlew assembleRelease`.
- **Expected:** The library uses the app's React Native (the tvOS fork)
- **Actual:** Its `react-native` peer dependency made npm install stock React Native 0.87 next to the app, shadowing react-native-tvos 0.86. The Android build then failed with misleading errors ("Minimum supported Gradle version is 9.4.1", then a Kotlin compiler crash after upgrading Gradle)
- **Severity:** High (blocked the TV build; cost ~1 hour)
- **Workaround:** Root `overrides: { "react-native": "npm:react-native-tvos@0.86-stable" }` and drop the stray lockfile entries
- **Suggestion:** Document the override in the Fire TV React Native setup guide, or have `expo install` warn when it would add a second React Native

## 9
**A 64-bit-only APK won't install on a 64-bit CPU stick** · Fire TV Stick (3rd gen) + React Native · 2026-10-14

- **Task:** Install a release APK built for `arm64-v8a` on a Fire TV Stick with a 64-bit Cortex-A53 CPU
- **Steps:**
  1. Build the release APK with `-PreactNativeArchitectures=arm64-v8a`.
  2. `adb install` it on a Fire TV Stick 3rd gen (AFTSSS).
- **Expected:** APK installs
- **Actual:** The stick runs a 32-bit-only Fire OS (`ro.product.cpu.abilist = armeabi-v7a`), so a 64-bit-only build can't install (`INSTALL_FAILED_NO_MATCHING_ABIS`). The device spec pages don't make the OS bitness obvious for every model
- **Severity:** High (app won't install)
- **Workaround:** Build with `-PreactNativeArchitectures=armeabi-v7a,arm64-v8a`
- **Suggestion:** List the supported ABIs (`abilist`) for every model in the Fire TV device specifications, and call it out in the React Native for Fire TV getting-started guide

## 10
**Fire TV text-to-speech is silent for apps, with no error** · Fire TV text-to-speech (Fire OS 7.7, Fire TV Stick 3rd gen) · 2026-10-14

- **Task:** Speak workout cues with Android's `TextToSpeech` API (via expo-speech)
- **Steps:**
  1. Fire TV Stick 3rd gen, Fire OS 7.7.1.7, default TTS engine.
  2. Call `Speech.speak('Hello')` (expo-speech → Android `TextToSpeech`).
  3. Listen, and read `adb logcat`.
- **Expected:** The device's default engine speaks the text
- **Actual:** The default engine (`com.ivona.tts.oem`) binds, accepts every request (`onSynthesizeText (eng/USA/)`) and logs "An error occur on reading voice configuration" — but never starts an audio player, so apps are silent with no error returned to them. Volume, mute and HDMI output were all fine
- **Severity:** High (the voice coach was silent on real hardware; the emulator's Google TTS worked, hiding it)
- **Workaround:** Pre-recorded every line with Amazon Polly (Kajal, en-IN neural) and play MP3s with expo-audio
- **Suggestion:** Make the Fire TV TTS engine usable by third-party apps (or report an error), and document which TTS voices/languages Fire OS provides to apps

## 11
**`adb am start` leaves the screensaver on top** · Fire TV (Fire OS 7.7) + ADB · 2026-10-15

- **Task:** Start the app with `adb shell am start` to test it while the stick is idle
- **Steps:**
  1. Leave the stick idle until the screensaver starts.
  2. `adb shell am start -n com.example/.MainActivity`.
  3. Take a screenshot with `adb exec-out screencap -p`.
- **Expected:** The app comes to the front
- **Actual:** The screensaver ("Dreaming", showing a Prime Video promotion) stays on top: the app runs behind it and screenshots show the promotion
- **Severity:** Low
- **Workaround:** Send `adb shell input keyevent KEYCODE_WAKEUP` before starting the app
- **Suggestion:** End the screensaver when an activity is started over ADB, or mention it in the Fire TV ADB/testing docs

## 12
**`RTCView` stays black when the track arrives without a stream** · react-native-webrtc 124 on Fire TV · 2026-10-15

- **Task:** Show a phone's WebRTC video in `RTCView`; the browser adds its camera track with `addTransceiver(track)` and no stream
- **Steps:**
  1. In the browser, `pc.addTransceiver(track, { direction: 'sendonly' })` without a stream.
  2. On the TV, `pc.ontrack = (e) => setUrl(e.streams[0]?.toURL())`.
  3. Render `<RTCView streamURL={url} />`.
- **Expected:** The video appears
- **Actual:** `ontrack` fires with an empty `streams` array, so there is no stream URL for `RTCView`: the stick decoded every frame (hardware H.264) but the screen stayed black, with no warning. Its TypeScript event types (`addEventListener`) also don't resolve
- **Severity:** Medium (looked like a decoding failure; ~30 min)
- **Workaround:** The phone sends the track inside a stream; the TV wraps a bare track in `new MediaStream([track])`; `on*` handlers instead of `addEventListener`
- **Suggestion:** Let `RTCView` take a track, or log a warning when a track has no stream; ship resolvable event types

## 13
**AppSync Events delivers a client's own events back to it** · AWS AppSync Events · 2026-10-15

- **Task:** Use a session channel for two-way WebRTC set-up: phone and TV each publish to it and subscribe to it
- **Steps:**
  1. Client A subscribes to `/session/x`.
  2. Client A publishes an event to `/session/x`.
  3. Watch A's subscription.
- **Expected:** Each side receives the other's messages
- **Actual:** Each subscriber also receives the events it published itself; I found no option to leave them out. Subscribing the phone to the session channel would also have sent it back its own pose stream (~12 messages a second)
- **Severity:** Low
- **Workaround:** Set-up messages carry a `from` field and use a `/rtc` sub-channel, so the existing pose stream isn't echoed to the phone
- **Suggestion:** A "don't deliver my own events" option on subscribe, or a note in the Events docs about echo

## 14
**Re-rendering a live skeleton in React saturates the stick's CPU** · React Native (new architecture) on Fire TV Stick 3rd gen · 2026-10-15

- **Task:** Draw a 13-point skeleton over live video, updated ~20 times a second
- **Steps:**
  1. Keep the latest pose in React state, updated ~20 times a second; draw 13 bones as Views.
  2. Run a workout on a Fire TV Stick 3rd gen.
  3. Measure with `adb shell dumpsys gfxinfo` and `top`.
- **Expected:** Smooth on TV hardware
- **Actual:** Re-rendering the skeleton in React on every pose kept the app at ~100% CPU, with 57% of frames over 16 ms
- **Severity:** Medium
- **Workaround:** Bones as native-driven `Animated.View`s whose values are set per pose (no React render): 43% of frames over 16 ms, median 16 ms
- **Suggestion:** A Fire TV performance guide for React Native on low-RAM sticks: native-driven animation for high-rate overlays, and how to profile frame times on the device

## 15
**Deleted assets stay in the release APK** · React Native release build (Gradle, Expo) · 2026-10-17

- **Task:** Delete 9 unused video assets and rebuild the release APK
- **Steps:**
  1. Delete 9 video files from `assets/` and every `require` of them.
  2. `./gradlew assembleRelease`.
  3. `unzip -l app-release.apk | grep <old name>`.
- **Expected:** The APK no longer contains them
- **Actual:** They were still in the APK: the bundle step copies assets into `android/app/build/generated/res/react/release` but never removes ones that are gone. Nothing warns, and the APK only shrank by a few KB
- **Severity:** Low (a bigger APK, and stale files are easy to miss)
- **Workaround:** Delete `app/build/generated/res/react` before the release build
- **Suggestion:** Clear the generated asset folder in the bundle task, or warn when it holds files the bundle no longer references

## 16
**D-pad focus can't leave a `ScrollView` for a button above it** · react-native-tvos on Android TV · 2026-10-17

- **Task:** Let the remote's UP move from a scrolling list of cards to a Back button above it
- **Steps:**
  1. Put a Back button above a `ScrollView` of focusable cards.
  2. Give the top cards `nextFocusUp` = the button's node handle.
  3. Press UP on the remote from a top card.
- **Expected:** Focus moves to the button
- **Actual:** A `ScrollView` keeps D-pad focus inside itself; `nextFocusUp` pointing outside it is ignored, and `nextFocusUp` isn't in Pressable's TypeScript types even though it works at runtime
- **Severity:** Medium (a screen whose Back button couldn't be reached with the remote)
- **Workaround:** Dropped the scroll view and made the list fit the screen
- **Suggestion:** Document how `ScrollView` and `nextFocus*` interact on Android TV; add `nextFocus*` to Pressable's types

## 17
**MediaPipe swaps left and right ankles facing the camera** · MediaPipe Pose (pose_landmarker_lite, web) · 2026-10-18

- **Task:** Count squats and lunges with the phone facing the person
- **Steps:**
  1. Run PoseLandmarker (lite, web) on a video of someone facing the camera doing squats.
  2. Log the left and right ankle x per frame.
  3. Repeat side-on and compare the world (3D) landmarks of the hidden leg.
- **Expected:** Left and right landmarks stay on the same leg
- **Actual:** Facing the camera, the left and right ankles swap for single frames, and side-on the 3D (world) depth of the hidden leg is unreliable; both broke rep judging ("the camera moved", lunges read as squats) until the engine was made label- and view-tolerant
- **Severity:** Medium
- **Workaround:** Match feet regardless of label; judge stance with view-specific cut-offs measured on real video
- **Suggestion:** Document the swap behaviour and per-view reliability of world landmarks in the Pose Landmarker guide

## 18
**Bedrock "Operation not allowed" with no reason (account verification)** · Amazon Bedrock (Converse, ap-south-1) · 2026-10-18

- **Task:** Call Amazon Nova 2 Lite from a Lambda with an IAM role that allows `bedrock:InvokeModel` on it
- **Steps:**
  1. Give a Lambda role `bedrock:InvokeModel` on the Nova 2 Lite inference profile.
  2. Call Converse from the Lambda in ap-south-1.
- **Expected:** A report comes back
- **Actual:** `ValidationException: Operation not allowed`, a 400 with no further detail; the cause was the account's pending verification (seen only on the Support dashboard), which also blocks Nova, not just third-party models
- **Severity:** High (blocks Analyse with AI)
- **Workaround:** Kept the feature behind a model list that can also use a second account's Claude; waiting on account verification
- **Suggestion:** Name the reason ("account verification pending") in the error, and say so on the Bedrock console before a first call

## 19
**Bedrock's two APIs need different IAM actions** · Amazon Bedrock (IAM, cross-account keys) · 2026-10-18

- **Task:** Call Claude with an IAM user's keys from another AWS account
- **Steps:**
  1. IAM user in a second account with a Bedrock policy.
  2. Call Claude through the Anthropic Bedrock SDK (Messages API) with its keys.
  3. Then call it through `InvokeModel`.
- **Expected:** Works if the user has Bedrock access
- **Actual:** `bedrock-mantle:CreateInference` and then `bedrock:InvokeModel` were each denied: the two Bedrock APIs need different IAM actions, so "has Bedrock access" isn't enough to know
- **Severity:** Medium
- **Workaround:** Lambda tries a list of models and logs each refusal; sent the exact policy statement to the account's IAM admin
- **Suggestion:** One managed policy (or a console checkbox) that covers both the Messages-API (mantle) and InvokeModel paths

## 20
**Claude on Bedrock needs AWS Marketplace permissions on first call** · Amazon Bedrock (third-party models) · 2026-10-19

- **Task:** Use Claude Haiku 4.5 for Analyse with AI
- **Steps:**
  1. The org account's admin allows `bedrock:InvokeModel` on the `in.anthropic.claude-haiku-4-5` inference profile and its foundation models.
  2. Call it from the coach Lambda with that IAM user's keys.
- **Expected:** With IAM allowing the model, the call works
- **Actual:** "Model access is denied due to IAM user or service role is not authorized to perform the required AWS Marketplace actions (aws-marketplace:ViewSubscriptions, aws-marketplace:Subscribe)". Nothing in the IAM policy, the model page or the Bedrock console said a Marketplace subscription is part of the first call
- **Severity:** Medium (an admin round-trip per model)
- **Workaround:** Switched to Amazon Nova Lite (no subscription needed) as the first model; Claude stays in the list for when the admin subscribes
- **Suggestion:** Show "needs a Marketplace subscription" on the model card and in the IAM policy examples; let an admin subscribe once from the Bedrock console

## 21
**Polly neural voices throttle a 4-way parallel recording job** · Amazon Polly (neural, ap-south-1) · 2026-10-19

- **Task:** Record the coach's voice lines in the deploy workflow
- **Steps:**
  1. Lambda records 117 coach lines with Polly neural (Kajal, ap-south-1), 4 `SynthesizeSpeech` calls at a time, SDK default retries.
  2. Run it from the deploy workflow.
- **Expected:** All 117 lines come back (they did the day before)
- **Actual:** `ThrottlingException: Rate exceeded` after the SDK's 3 attempts (70 ms total retry delay); the error doesn't say what the limit is or how long to wait. The same job had passed the day before
- **Severity:** Medium (blocked a release until diagnosed)
- **Workaround:** 2 requests at a time and `retryMode: 'adaptive'` with up to 10 attempts; recorded all 117 lines
- **Suggestion:** Put the neural TPS limit for the Region in the throttling error and in the Polly quotas page; default to adaptive retries for Polly in the SDK

## 22
**The home screen keeps a sideloaded app's first name and icon** · Fire TV launcher (Fire OS 8.1, Fire TV Stick 4K) · 2026-10-21

- **Task:** Ship the renamed app (Spotter → RepCast) with its new icon and banner to our test stick
- **Steps:**
  1. Install a build on Oct 16 (label "Spotter", tally-mark icon).
  2. Install updates with `adb install -r`, the latest with label "RepCast", a new icon and banner, and `versionCode` raised from 1 to 2.
  3. Reboot the stick.
- **Expected:** "Your apps and channels" shows the new name and banner after the update (`aapt dump badging` on the APK shows label RepCast and the new banner)
- **Actual:** The tile still said "Spotter" with the Oct 16 icon after the update and after a reboot. The launcher is a protected package (it can't be force-stopped) and Fire OS has Android's backup service off, so `adb backup` writes an empty file — the only fix is uninstall and reinstall, which wipes the app's data
- **Severity:** Medium (a stale brand on the device we film the demo on; data loss unless worked around)
- **Workaround:** Temporarily installed a debuggable build with the same signature, copied the app's database out with `run-as`, uninstalled, reinstalled, copied it back, then installed the release build over it. The tile now reads RepCast with the new icon
- **Suggestion:** Refresh launcher tiles on `PACKAGE_REPLACED` when the label, icon or banner changes, or document the cache and add a "refresh app tiles" option in developer settings

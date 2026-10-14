#!/usr/bin/env node
// Plays the phone's side of a coached squat workout against the real backend, so the TV app can be
// tested without anyone squatting: pairs with the code on the TV, sends framing, a moving outline
// and a scripted set of rep verdicts (clean reps, form notes and no-reps).
//
//   node tools/fake-phone.mjs <code> [--start-after 8] [--rest 32] [--rep-ms 1600]
//
// Start it, then press "Start workout" on the TV within --start-after seconds. --rest should be a
// little longer than the TV's rest between sets.
import { readFileSync } from 'node:fs';

const configSource = readFileSync(new URL('../packages/shared/src/config.ts', import.meta.url), 'utf8');
const read = (key) => configSource.match(new RegExp(`${key}: '([^']+)'`))[1];
const API = read('apiUrl');
const HTTP_HOST = read('eventsHttpHost');
const API_KEY = read('eventsApiKey');

const args = process.argv.slice(2);
const code = args.find((a) => /^\d{4}$/.test(a));
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
if (!code) {
  console.error('usage: node tools/fake-phone.mjs <4-digit code> [--start-after 8] [--rest 32] [--rep-ms 1600]');
  process.exit(1);
}
const START_AFTER = option('start-after', 8) * 1000;
const REST_MS = option('rest', 32) * 1000;
const REP_MS = option('rep-ms', 1600);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function publish(channel, ...events) {
  const res = await fetch(`https://${HTTP_HOST}/event`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify({ channel, events: events.map((e) => JSON.stringify({ ...e, at: Date.now() })) }),
  });
  if (!res.ok) throw new Error(`publish failed: ${res.status} ${await res.text()}`);
}

// Outline keyframes on a square grid (POSE_POINTS order), standing and at the bottom of a squat.
const STAND = [0.5, 0.21, 0.42, 0.3, 0.58, 0.3, 0.4, 0.41, 0.6, 0.41, 0.42, 0.51, 0.58, 0.51, 0.45, 0.5, 0.55, 0.5, 0.43, 0.69, 0.57, 0.69, 0.44, 0.87, 0.56, 0.87];
const SQUAT = [0.5, 0.39, 0.42, 0.47, 0.58, 0.47, 0.4, 0.5, 0.6, 0.5, 0.42, 0.5, 0.58, 0.5, 0.45, 0.65, 0.55, 0.65, 0.39, 0.69, 0.61, 0.69, 0.44, 0.87, 0.56, 0.87];
const pose = (t) => ({ type: 'pose', p: STAND.map((v, i) => Math.round((v + (SQUAT[i] - v) * t) * 1000) / 1000), aspect: 1, mirrored: false });

const CLEAN = { counted: true, verdict: 'good', depthOk: true, faults: [], cues: [] };
const KNEES = { counted: true, verdict: 'fix', depthOk: true, faults: ['knees-caving'], cues: ['Push your knees out'] };
const SHALLOW = { counted: false, verdict: 'no-rep', depthOk: false, faults: [], cues: ["Not deep enough — that one doesn't count"] };

// Three sets of 12: a shaky first set, a better second, a tired third.
const SETS = [
  [SHALLOW, CLEAN, KNEES, CLEAN, SHALLOW, CLEAN, CLEAN, KNEES, CLEAN, CLEAN, CLEAN, CLEAN, CLEAN, CLEAN],
  [CLEAN, CLEAN, CLEAN, KNEES, CLEAN, CLEAN, CLEAN, CLEAN, CLEAN, CLEAN, CLEAN, CLEAN],
  [CLEAN, CLEAN, CLEAN, CLEAN, CLEAN, SHALLOW, CLEAN, CLEAN, KNEES, CLEAN, CLEAN, CLEAN, CLEAN],
];

const { channel } = await (await fetch(`${API}/sessions/${code}`)).json();
if (!channel) throw new Error(`No session for code ${code}`);
console.log(`paired with ${code} → ${channel}`);

await publish(channel, { type: 'hello', device: 'fake-phone' });
const framing = { type: 'framing', visible: { head: true, hips: true, knees: true, feet: true }, sideOn: false };
for (let waited = 0; waited < START_AFTER; waited += 1000) {
  await publish(channel, framing, pose(0));
  await sleep(1000);
}

for (const [setIndex, attempts] of SETS.entries()) {
  let count = 0;
  for (const attempt of attempts) {
    // Move the outline down and back up over the rep (5 frames a second), then send the verdict.
    const frames = Math.round(REP_MS / 200);
    for (let f = 1; f <= frames; f++) {
      await publish(channel, pose(Math.sin((f / frames) * Math.PI) * (attempt === SHALLOW ? 0.45 : 1)));
      await sleep(200);
    }
    if (attempt.counted) count += 1;
    await publish(channel, { type: 'rep', exercise: 'squat', count, ...attempt });
    console.log(`set ${setIndex + 1}: ${attempt.verdict}${attempt.counted ? ` (${count})` : ''}`);
  }
  if (setIndex < SETS.length - 1) {
    console.log(`resting ${REST_MS / 1000}s`);
    await sleep(REST_MS);
  }
}
await publish(channel, { type: 'bye' });
console.log('done');

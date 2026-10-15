#!/usr/bin/env node
// Lists every line the coach can say — follow-along workouts (including swapped moves) and camera
// coaching (intros, verdicts, form cues, framing help) — for pre-recording with Amazon Polly.
// Writes tools/voice/phrases.json.
//
//   node tools/voice/phrases.mjs
//
// Needs Node 22.18+ / 24 (runs the app's TypeScript directly).
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', '..', 'apps', 'tv', 'src');
const { LEGS_GENTLY, SWAP_OPTIONS } = await import(join(src, 'workouts.ts'));
const { coachIntroLine, countLine, ENGINE_CUES, FINISH_LINE, HINT_LINES, MAX_SPOKEN_COUNT, NO_REP_LINE, PHONE_LINKED_LINE, READY_LINE, restLine, setIntroLine, voiceId } =
  await import(join(src, 'voiceLines.ts'));
// The movement engine's exercise definitions hold each exercise's own advice.
const { EXERCISES } = await import(join(here, '..', '..', 'node_modules', 'spotter-movement', 'dist', 'index.js'));

const lines = new Set([FINISH_LINE]);
for (let n = 1; n <= MAX_SPOKEN_COUNT; n++) lines.add(countLine(n));

const base = LEGS_GENTLY.steps;
base.forEach((original, i) => {
  const options = SWAP_OPTIONS[original.id] ?? [original];
  for (const step of options) {
    if (step.kind === 'timed') lines.add(step.cue);
    else for (let set = 0; set < step.sets; set++) lines.add(setIntroLine(step, set));
    // Rests: before the next set of this move, or before whichever option of the next move is chosen.
    if (step.kind === 'reps') for (let set = 2; set <= step.sets; set++) lines.add(restLine(`set ${set}`));
    const next = base[i + 1];
    if (next) for (const option of SWAP_OPTIONS[next.id] ?? [next]) lines.add(restLine(option.name));
  }
});

// Camera coaching.
for (const line of [NO_REP_LINE, PHONE_LINKED_LINE, READY_LINE, ...Object.values(HINT_LINES), ...ENGINE_CUES]) lines.add(line);
for (const options of Object.values(SWAP_OPTIONS)) for (const step of options) if (step.kind === 'reps') lines.add(coachIntroLine(step.name, step.reps));
for (const exercise of Object.values(EXERCISES)) {
  const cues = [exercise.depth?.cue, exercise.depth?.noRepCue, exercise.stance?.cue, ...(exercise.targets ?? []).map((t) => t.cue)];
  for (const check of exercise.checks ?? []) cues.push(check.cue, check.failCue);
  for (const cue of cues) if (cue) lines.add(cue);
}

const phrases = [...lines].map((text) => ({ id: voiceId(text), text })).sort((a, b) => a.id.localeCompare(b.id));
const ids = new Set(phrases.map((p) => p.id));
if (ids.size !== phrases.length) throw new Error('Two lines share a voice id');
writeFileSync(join(here, 'phrases.json'), JSON.stringify(phrases, null, 2) + '\n');
console.log(`${phrases.length} lines, ${phrases.reduce((n, p) => n + p.text.length, 0)} characters → tools/voice/phrases.json`);

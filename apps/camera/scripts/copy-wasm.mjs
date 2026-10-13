// Copies MediaPipe's WebAssembly runtime into public/ so the app serves it itself (no CDN at runtime).
import { cpSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const packageDir = dirname(require.resolve('@mediapipe/tasks-vision'));
const target = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'mediapipe', 'wasm');

mkdirSync(target, { recursive: true });
cpSync(join(packageDir, 'wasm'), target, { recursive: true });
console.log(`MediaPipe wasm copied to ${target}`);

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// `SPOTTER_HTTPS=1 npm run dev` serves over HTTPS with a local self-signed certificate
// (apps/camera/.cert, git-ignored), so a phone on the Wi-Fi may use its camera with the dev server.
const certDir = resolve(import.meta.dirname, '.cert');
const https =
  process.env.SPOTTER_HTTPS === '1' && existsSync(resolve(certDir, 'key.pem'))
    ? { key: readFileSync(resolve(certDir, 'key.pem')), cert: readFileSync(resolve(certDir, 'cert.pem')) }
    : undefined;

// `SPOTTER_MOVEMENT_SRC=1 npm run dev` uses the movement engine's source from a sibling checkout
// (../repcast-movement next to this repo) instead of the installed package, to test engine changes
// on the replay bench before publishing them.
// The engine's checkout may still sit in a folder with its old name.
const engineSrc = ['repcast-movement', 'spotter-movement'].map((d) => resolve(import.meta.dirname, `../../../${d}/src/index.ts`)).find((p) => existsSync(p)) ?? '';
const alias: Record<string, string> = process.env.SPOTTER_MOVEMENT_SRC === '1' && existsSync(engineSrc) ? { 'repcast-movement': engineSrc } : {};

export default defineConfig({
  resolve: { alias },
  // Relative paths so the same build works on GitHub Pages (/repcast-tv-app/) and locally.
  base: './',
  server: { https },
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        replay: resolve(import.meta.dirname, 'replay.html'),
        videoTest: resolve(import.meta.dirname, 'video-test.html'),
      },
    },
  },
});

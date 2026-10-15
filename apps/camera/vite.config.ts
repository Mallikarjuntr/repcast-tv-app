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

export default defineConfig({
  // Relative paths so the same build works on GitHub Pages (/spotter-tv-app/) and locally.
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

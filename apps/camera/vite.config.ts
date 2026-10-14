import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths so the same build works on GitHub Pages (/spotter-tv-app/) and locally.
  base: './',
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        replay: resolve(import.meta.dirname, 'replay.html'),
      },
    },
  },
});

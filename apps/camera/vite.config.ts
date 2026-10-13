import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths so the same build works on GitHub Pages (/spotter-tv-app/) and locally.
  base: './',
  build: {
    target: 'es2022',
  },
});

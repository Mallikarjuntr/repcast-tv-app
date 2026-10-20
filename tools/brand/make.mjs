// Draws RepCast's app icon, TV banner, splash, Appstore images and web icons: the Leap-ring mark
// (an athlete leaping inside an orange ring) on a dark tile, the "repcast." wordmark and the app's
// "Studio" colours, with the app's own fonts turned into outlines so every image renders the same.
//
//   cd tools/brand && npm install && npm run build
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FONTS = join(ROOT, 'node_modules', '@expo-google-fonts');
const APP_IMAGES = join(ROOT, 'apps', 'tv', 'assets', 'images');
const STORE = join(ROOT, 'docs', 'store');

// The app's palette (apps/tv/src/theme.ts).
const BG = '#15120F';
const SURFACE = '#221E1A';
const TEXT = '#F4EFE8';
const MUTED = '#B5ACA0';
const ACCENT = '#FF7A3D';

// The app's type since 2026-10-18: Barlow Semi Condensed for the name, Barlow for the tagline.
const display = opentype.loadSync(join(FONTS, 'barlow-semi-condensed', '800ExtraBold', 'BarlowSemiCondensed_800ExtraBold.ttf'));
const label = opentype.loadSync(join(FONTS, 'barlow', '600SemiBold', 'Barlow_600SemiBold.ttf'));

/** Text as an outline path; x is the left edge, y the baseline. Returns the path and its box. */
function text(font, value, x, y, size, { fill = TEXT, tracking = 0 } = {}) {
  let d = '';
  let cursor = x;
  if (tracking === 0) {
    const path = font.getPath(value, x, y, size);
    const box = path.getBoundingBox();
    return { svg: `<path d="${path.toPathData(2)}" fill="${fill}"/>`, box, advance: font.getAdvanceWidth(value, size) };
  }
  for (const ch of value) {
    d += font.getPath(ch, cursor, y, size).toPathData(2);
    cursor += font.getAdvanceWidth(ch, size) + tracking;
  }
  return { svg: `<path d="${d}" fill="${fill}"/>`, box: { x1: x, x2: cursor - tracking }, advance: cursor - tracking - x };
}

function measure(font, value, size) {
  const box = font.getPath(value, 0, 0, size).getBoundingBox();
  return { width: box.x2 - box.x1, left: box.x1, top: box.y1, bottom: box.y2 };
}

/** The icon tile: a shade warmer than the app's background, so it stands out on the Fire TV home row. */
const TILE = '#1B1714';
let gradients = 0;

/**
 * The mark on a 100-unit grid, placed at (x, y) and `size` across: an athlete leaping inside a ring
 * ("K · Leap ring", chosen 2026-10-19). The athlete was generated with FLUX.1 [schnell] (Apache-2.0)
 * and traced to one solid vector shape (leap-mark.json); the ring is an exact circle in the accent.
 * `tile` draws the dark rounded tile behind it (`radius` 0 for a full-bleed square); without it the
 * ring and athlete are drawn on whatever is behind, the athlete in `color`.
 */
const LEAP = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'leap-mark.json'), 'utf8'));
function mark(x, y, size, { tile = true, radius = 22, color = TEXT, ring = ACCENT, ringOpacity = 1 } = {}) {
  const bg = tile ? `<rect width="100" height="100" rx="${radius}" fill="${TILE}"/>` : '';
  const circle = `<circle cx="50" cy="50" r="${LEAP.ringR}" fill="none" stroke="${ring}" stroke-opacity="${ringOpacity}" stroke-width="4.6"/>`;
  const athlete = `<g transform="${LEAP.transform}"><path d="${LEAP.d}" fill="${color}"/></g>`;
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 100 100">${bg}${circle}${athlete}</svg>`;
}

/** The "repcast." wordmark (components/Type.Wordmark), the full stop in the accent; left edge at x, baseline at y. */
function wordmark(x, y, size) {
  const word = text(display, 'repcast', x, y, size);
  const dot = text(display, '.', x + display.getAdvanceWidth('repcast', size), y, size, { fill: ACCENT });
  const w = word.box.x2 - word.box.x1;
  return { svg: word.svg + dot.svg, width: w, box: word.box };
}

function svg(w, h, body, background = BG) {
  const bg = background ? `<rect width="${w}" height="${h}" fill="${background}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${bg}${body}</svg>`;
}

/** A soft orange glow, for depth behind the lockups. */
function glow(w, h, cx, cy, r) {
  const id = `glow${gradients++}`;
  return `<defs><radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}"><stop offset="0" stop-color="${ACCENT}" stop-opacity="0.22"/><stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/></radialGradient></defs><rect width="${w}" height="${h}" fill="url(#${id})"/>`;
}

/**
 * Landscape lockup: the tile, then "repcast." with a tagline under it, centred in a safe box.
 * `tagline` may be empty.
 */
function lockup(w, h, safeW, safeH, { tagline = 'Your TV checks every rep', glowing = true } = {}) {
  const tile = safeH * 0.62;
  const size = tile * 0.62;
  const m = measure(display, 'repcast.', size);
  const tagSize = size * 0.24;
  const gap = tile * 0.16;
  let total = tile + gap + m.width;
  const fit = Math.min(1, (safeW * 0.96) / total);
  const T = tile * fit;
  const S = size * fit;
  const M = measure(display, 'repcast.', S);
  const G = gap * fit;
  total = T + G + M.width;
  const left = (w - total) / 2;
  const top = (h - T) / 2;
  // The wordmark's cap height sits a little above the tile's middle; the tagline below it.
  const baseline = top + T * (tagline ? 0.58 : 0.66);
  const word = wordmark(left + T + G - M.left, baseline, S);
  let body = (glowing ? glow(w, h, '0.32', '0.5', '0.55') : '') + mark(left, top, T) + word.svg;
  if (tagline) body += text(label, tagline, left + T + G, baseline + tagSize * fit * 1.9, tagSize * fit, { fill: MUTED }).svg;
  return body;
}

/** Fire TV detail-page background: the dark studio with a large, faint ring-and-figure and a glow. */
function background(w, h) {
  const size = h * 1.1;
  return svg(w, h, glow(w, h, '0.72', '0.45', '0.6') + `<g opacity="0.16">${mark(w - size * 0.92, (h - size) / 2, size, { tile: false, color: TEXT })}</g>`);
}

async function write(svgText, file, { width, height, format = 'png' } = {}) {
  mkdirSync(dirname(file), { recursive: true });
  // Render at 2x for smooth edges, then scale to the target (the SVG's own size unless given).
  const [, w, h] = svgText.match(/width="(\d+)" height="(\d+)"/);
  let image = sharp(Buffer.from(svgText), { density: 144 }).resize(width ?? Number(w), height ?? Number(h));
  // Images with a background carry no alpha channel (the Appstore's Fire TV icon must not).
  if (svgText.includes('<rect width=')) image = image.flatten({ background: BG });
  image = format === 'jpeg' ? image.jpeg({ quality: 92 }) : image.png();
  await image.toFile(file);
  console.log('wrote', file.replace(ROOT + '/', ''));
}

// In the app. The launcher icon is a full-bleed square (the launcher rounds it); the adaptive
// icon's foreground is the ring and athlete alone, on the dark tile colour set in app.json.
await write(svg(1024, 1024, mark(0, 0, 1024, { radius: 0 }), null), join(APP_IMAGES, 'icon.png'));
await write(svg(1024, 1024, mark(1024 * 0.2, 1024 * 0.2, 1024 * 0.6, { tile: false }), null), join(APP_IMAGES, 'adaptive-icon.png'));
await write(svg(1280, 720, lockup(1280, 720, 1040, 560)), join(APP_IMAGES, 'tv-banner.png'), { width: 640, height: 360 });
await write(svg(1200, 400, lockup(1200, 400, 1000, 300, { tagline: '', glowing: false }), null), join(APP_IMAGES, 'splash.png'));

// Amazon Appstore listing (Fire TV icon keeps its art inside the 882 x 448 safe zone).
await write(svg(1280, 720, lockup(1280, 720, 882, 448)), join(STORE, 'fire-tv-icon-1280x720.png'));
await write(background(1920, 1080), join(STORE, 'fire-tv-background-1920x1080.jpg'), { format: 'jpeg' });
await write(svg(512, 512, mark(0, 0, 512, { radius: 0 }), null), join(STORE, 'icon-512.png'));
await write(svg(512, 512, mark(0, 0, 512, { radius: 0 }), null), join(STORE, 'icon-114.png'), { width: 114, height: 114 });

// Web: the phone camera page and the website (copied into repcast-tv-landing-page/assets/img).
const WEB = join(STORE, 'web');
await write(svg(512, 512, mark(0, 0, 512), null), join(WEB, 'favicon.png'), { width: 64, height: 64 });
await write(svg(512, 512, mark(0, 0, 512, { radius: 0 }), null), join(WEB, 'apple-touch-icon.png'), { width: 180, height: 180 });
await write(svg(1200, 630, lockup(1200, 630, 1000, 420, { tagline: 'Your TV checks every rep' })), join(WEB, 'og.png'));
// The mark as a small SVG for site headers (the tile, ring and athlete; no text).
mkdirSync(WEB, { recursive: true });
writeFileSync(join(WEB, 'mark.svg'), svg(100, 100, mark(0, 0, 100), null));
console.log('wrote docs/store/web/mark.svg');

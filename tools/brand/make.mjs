// Draws Spotter's app icon, TV banner, splash and Appstore images: an orange tile with a figure
// mid-squat inside a rep ring, the "spotter." wordmark and the app's "Studio" colours, with the
// app's own fonts turned into outlines so every image renders the same anywhere.
//
//   cd tools/brand && npm install && npm run build
import { mkdirSync } from 'node:fs';
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

const display = opentype.loadSync(join(FONTS, 'archivo', '800ExtraBold', 'Archivo_800ExtraBold.ttf'));
const label = opentype.loadSync(join(FONTS, 'archivo', '700Bold', 'Archivo_700Bold.ttf'));

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

/** The tile's two oranges, top-left to bottom-right. */
const TILE_FROM = '#FF9A57';
const TILE_TO = '#E2471F';
const MARK_WHITE = '#FFF4E8';
let gradients = 0;

/**
 * The mark on a 100-unit grid, placed at (x, y) and `size` across: a figure mid-squat inside a rep
 * ring that is three-quarters round. `tile` draws the orange rounded tile behind it (`radius` 0 for
 * a full-bleed square); without it the ring and figure are drawn in `color` on whatever is behind.
 */
function mark(x, y, size, { tile = true, radius = 22, color = MARK_WHITE, ringOpacity = 0.35 } = {}) {
  const id = `tile${gradients++}`;
  const c = 2 * Math.PI * 34;
  const bg = tile
    ? `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${TILE_FROM}"/><stop offset="1" stop-color="${TILE_TO}"/></linearGradient></defs><rect width="100" height="100" rx="${radius}" fill="url(#${id})"/>`
    : '';
  const ring =
    `<circle cx="50" cy="51" r="34" fill="none" stroke="${color}" stroke-opacity="${ringOpacity}" stroke-width="6"/>` +
    `<circle cx="50" cy="51" r="34" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(c * 0.72).toFixed(2)} ${c.toFixed(2)}" transform="rotate(-90 50 51)"/>`;
  // Side view, facing right: head, back, thigh, shin and foot, arms held forward for balance.
  const figure =
    `<g fill="none" stroke="${tile ? '#FFFFFF' : color}" stroke-width="6.2" stroke-linecap="round" stroke-linejoin="round" transform="translate(-4 0)">` +
    `<path d="M52 39 L43 56 L59 61 L55 74 L62 74"/><path d="M51 42 L67 45"/></g>` +
    `<circle cx="51" cy="30" r="6.3" fill="${tile ? '#FFFFFF' : color}"/>`;
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 100 100">${bg}${ring}${figure}</svg>`;
}

/** The "spotter." wordmark (components/Type.Wordmark), the full stop in the accent; left edge at x, baseline at y. */
function wordmark(x, y, size) {
  const word = text(display, 'spotter', x, y, size);
  const dot = text(display, '.', x + display.getAdvanceWidth('spotter', size), y, size, { fill: ACCENT });
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
 * Landscape lockup: the tile, then "spotter." with a tagline under it, centred in a safe box.
 * `tagline` may be empty.
 */
function lockup(w, h, safeW, safeH, { tagline = 'Your TV checks every rep', glowing = true } = {}) {
  const tile = safeH * 0.62;
  const size = tile * 0.62;
  const m = measure(display, 'spotter.', size);
  const tagSize = size * 0.24;
  const gap = tile * 0.16;
  let total = tile + gap + m.width;
  const fit = Math.min(1, (safeW * 0.96) / total);
  const T = tile * fit;
  const S = size * fit;
  const M = measure(display, 'spotter.', S);
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
  return svg(w, h, glow(w, h, '0.72', '0.45', '0.6') + `<g opacity="0.16">${mark(w - size * 0.92, (h - size) / 2, size, { tile: false, color: TEXT, ringOpacity: 0.5 })}</g>`);
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
// icon's foreground is the ring and figure alone, on the orange set in app.json.
await write(svg(1024, 1024, mark(0, 0, 1024, { radius: 0 }), null), join(APP_IMAGES, 'icon.png'));
await write(svg(1024, 1024, mark(1024 * 0.2, 1024 * 0.2, 1024 * 0.6, { tile: false }), null), join(APP_IMAGES, 'adaptive-icon.png'));
await write(svg(1280, 720, lockup(1280, 720, 1040, 560)), join(APP_IMAGES, 'tv-banner.png'), { width: 640, height: 360 });
await write(svg(1200, 400, lockup(1200, 400, 1000, 300, { tagline: '', glowing: false }), null), join(APP_IMAGES, 'splash.png'));

// Amazon Appstore listing (Fire TV icon keeps its art inside the 882 x 448 safe zone).
await write(svg(1280, 720, lockup(1280, 720, 882, 448)), join(STORE, 'fire-tv-icon-1280x720.png'));
await write(background(1920, 1080), join(STORE, 'fire-tv-background-1920x1080.jpg'), { format: 'jpeg' });
await write(svg(512, 512, mark(0, 0, 512, { radius: 0 }), null), join(STORE, 'icon-512.png'));
await write(svg(512, 512, mark(0, 0, 512, { radius: 0 }), null), join(STORE, 'icon-114.png'), { width: 114, height: 114 });

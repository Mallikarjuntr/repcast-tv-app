// Draws Spotter's app icon, TV banner, splash and Appstore images in the app's "training notebook"
// style, with the app's own fonts turned into outlines so every image renders the same anywhere.
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
const PAPER = '#EFE8DA';
const PAPER_DEEP = '#E4DAC6';
const INK = '#1D1B17';
const PENCIL = '#5E584C';
const PEN = '#C0321B';

const display = opentype.loadSync(join(FONTS, 'fraunces', '600SemiBold_Italic', 'Fraunces_600SemiBold_Italic.ttf'));
const mono = opentype.loadSync(join(FONTS, 'ibm-plex-mono', '500Medium', 'IBMPlexMono_500Medium.ttf'));

/** Text as an outline path; x is the left edge, y the baseline. Returns the path and its box. */
function text(font, value, x, y, size, { fill = INK, tracking = 0 } = {}) {
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

/**
 * The mark: a tally group — four ink strokes struck through by the coach's red pen. `h` is the
 * stroke height; (x, y) is the top-left of the strokes. Slightly uneven, like it was drawn by hand.
 */
function tally(x, y, h, { ink = INK, pen = PEN } = {}) {
  const gap = h * 0.25;
  const width = h * 0.115;
  const wobble = [
    [0.02, -0.03, 0.0],
    [-0.025, 0.02, 0.03],
    [0.03, -0.01, -0.02],
    [-0.01, 0.03, 0.01],
  ];
  const strokes = wobble
    .map(([top, bottom, lift], i) => {
      const sx = x + i * gap;
      return `<path d="M${sx + top * h} ${y + lift * h} L${sx + bottom * h} ${y + h * (1 + lift * 0.5)}" stroke="${ink}" stroke-width="${width}" stroke-linecap="round" fill="none"/>`;
    })
    .join('');
  const slash = `<path d="M${x - gap * 0.75} ${y + h * 0.8} C ${x + gap} ${y + h * 0.62}, ${x + gap * 2.4} ${y + h * 0.42}, ${x + gap * 3.9} ${y + h * 0.16}" stroke="${pen}" stroke-width="${width * 0.95}" stroke-linecap="round" fill="none"/>`;
  return { svg: strokes + slash, width: gap * 3, left: x - gap * 0.75 - width / 2, right: x + gap * 3.9 + width / 2 };
}

/** The red-pen swash under the wordmark (Marks.Swash), stretched to `w`. */
function swash(x, y, w, strokeWidth) {
  const k = w / 118;
  return `<path d="M${x + 2 * k} ${y + 8 * k} C ${x + 30 * k} ${y + 3 * k}, ${x + 70 * k} ${y + 2 * k}, ${x + 116 * k} ${y + 6 * k}" stroke="${PEN}" stroke-width="${strokeWidth}" stroke-linecap="round" fill="none"/>`;
}

/** The "spotter" wordmark with its swash, left edge at x and baseline at y. */
function wordmark(x, y, size) {
  const word = text(display, 'spotter', x, y, size);
  const w = word.box.x2 - word.box.x1;
  return { svg: word.svg + swash(word.box.x1 + w * 0.02, y + size * 0.16, w * 0.94, size * 0.055), width: w, box: word.box };
}

function svg(w, h, body, background = PAPER) {
  const bg = background ? `<rect width="${w}" height="${h}" fill="${background}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${bg}${body}</svg>`;
}

/** Square icon: the tally mark alone, centred. `scale` is how much of the square it fills. */
function squareIcon(size, { scale = 0.56, background = PAPER } = {}) {
  const h = size * scale;
  const probe = tally(0, 0, h);
  const span = probe.right - probe.left;
  const x = (size - span) / 2 - probe.left;
  const y = (size - h) / 2;
  return svg(size, size, tally(x, y, h).svg, background);
}

/** Landscape lockup: tally + wordmark, fitted into a centred safe box. */
function lockup(w, h, safeW, safeH, { kicker } = {}) {
  const size = safeH * (kicker ? 0.52 : 0.6);
  const m = measure(display, 'spotter', size);
  const tallyH = size * 0.74;
  const probe = tally(0, 0, tallyH);
  const tallySpan = probe.right - probe.left;
  const gap = size * 0.32;
  let total = tallySpan + gap + m.width;
  const fit = Math.min(1, (safeW * 0.94) / total);
  const s = size * fit;
  const mm = measure(display, 'spotter', s);
  const th = tallyH * fit;
  const tp = tally(0, 0, th);
  total = tp.right - tp.left + gap * fit + mm.width;
  const left = (w - total) / 2;
  // Optical centre: the x-height of the wordmark sits on the middle line.
  const kickerSize = s * 0.16;
  const blockH = (mm.bottom - mm.top) + (kicker ? s * 0.5 + kickerSize : 0);
  const baseline = (h - blockH) / 2 - mm.top + (kicker ? 0 : s * 0.04);
  const t = tally(left - tp.left, baseline - th * 1.0, th);
  const word = wordmark(left + (tp.right - tp.left) + gap * fit - mm.left, baseline, s);
  let body = t.svg + word.svg;
  if (kicker) {
    const k = text(mono, kicker, 0, 0, kickerSize, { tracking: kickerSize * 0.14 });
    const kx = (w - k.advance) / 2;
    body += text(mono, kicker, kx, baseline + s * 0.62 + kickerSize, kickerSize, { fill: PENCIL, tracking: kickerSize * 0.14 }).svg;
  }
  return body;
}

// A squat outline (front view) for the background art, in POSE order on a square grid.
const SQUAT = [0.5, 0.39, 0.42, 0.47, 0.58, 0.47, 0.4, 0.5, 0.6, 0.5, 0.42, 0.5, 0.58, 0.5, 0.45, 0.65, 0.55, 0.65, 0.39, 0.69, 0.61, 0.69, 0.44, 0.87, 0.56, 0.87];
const BONES = [[1, 2], [1, 3], [3, 5], [2, 4], [4, 6], [1, 7], [2, 8], [7, 8], [7, 9], [9, 11], [8, 10], [10, 12]];

function figure(points, x, y, size, color, strokeWidth) {
  const p = (i) => [x + points[i * 2] * size, y + points[i * 2 + 1] * size];
  const lines = BONES.map(([a, b]) => {
    const [x1, y1] = p(a);
    const [x2, y2] = p(b);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  }).join('');
  const [hx, hy] = p(0);
  return `<g stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" fill="none">${lines}<circle cx="${hx}" cy="${hy}" r="${size * 0.052}"/></g>`;
}

/** Fire TV detail-page background: ruled notebook paper, a red margin, a faint squat sketch. */
function background(w, h) {
  let rules = '';
  for (let y = 120; y < h; y += 54) rules += `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${PAPER_DEEP}" stroke-width="2"/>`;
  const margin = `<line x1="150" y1="0" x2="150" y2="${h}" stroke="${PEN}" stroke-opacity="0.35" stroke-width="2.5"/>`;
  const sketch = figure(SQUAT, w * 0.42, h * -0.42, h * 1.5, '#D8CCB3', 18);
  const marks = tally(w * 0.6, h * 0.76, 120, { ink: '#D8CCB3', pen: PEN }).svg;
  return svg(w, h, rules + margin + sketch + `<g opacity="0.55">${marks}</g>`);
}

async function write(svgText, file, { width, height, format = 'png' } = {}) {
  mkdirSync(dirname(file), { recursive: true });
  // Render at 2x for smooth edges, then scale to the target (the SVG's own size unless given).
  const [, w, h] = svgText.match(/width="(\d+)" height="(\d+)"/);
  let image = sharp(Buffer.from(svgText), { density: 144 }).resize(width ?? Number(w), height ?? Number(h));
  // Images drawn on paper carry no alpha channel (the Appstore's Fire TV icon must not).
  if (svgText.includes('<rect width=')) image = image.flatten({ background: PAPER });
  image = format === 'jpeg' ? image.jpeg({ quality: 92 }) : image.png();
  await image.toFile(file);
  console.log('wrote', file.replace(ROOT + '/', ''));
}

// In the app.
await write(squareIcon(1024), join(APP_IMAGES, 'icon.png'));
await write(squareIcon(1024, { scale: 0.4, background: null }), join(APP_IMAGES, 'adaptive-icon.png'));
await write(svg(1280, 720, lockup(1280, 720, 1000, 520)), join(APP_IMAGES, 'tv-banner.png'), { width: 640, height: 360 });
await write(svg(1200, 400, lockup(1200, 400, 1000, 300), null), join(APP_IMAGES, 'splash.png'));

// Amazon Appstore listing (Fire TV icon keeps its art inside the 882 x 448 safe zone).
await write(svg(1280, 720, lockup(1280, 720, 882, 448, { kicker: 'YOUR AT-HOME FITNESS SPOTTER' })), join(STORE, 'fire-tv-icon-1280x720.png'));
await write(background(1920, 1080), join(STORE, 'fire-tv-background-1920x1080.jpg'), { format: 'jpeg' });
await write(squareIcon(512), join(STORE, 'icon-512.png'));
await write(squareIcon(512), join(STORE, 'icon-114.png'), { width: 114, height: 114 });

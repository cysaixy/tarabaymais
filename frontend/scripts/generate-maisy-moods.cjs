/**
 * Generates Maisy mood variants from the original pixel-art mascot.
 *   node scripts/generate-maisy-moods.cjs
 * Output: public/assets/maisy/maisy-<mood>.png (all the same canvas size).
 *
 * Expressions are edited at the pixel level (only the dark mouth pixels are
 * recoloured, so the kernel texture stays); props are pixel sprites drawn on a
 * grid with black outlines to match the original art style.
 */
const path = require("node:path");
const fs = require("node:fs");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "public/assets/mascot-maisy.png");
const OUT_DIR = path.join(ROOT, "public/assets/maisy");

// Canvas with room above/right for props. Maisy is placed at (OX, OY).
const W = 1150;
const H = 1440; // extra room under the feet for the ground shadow
const OX = 40;
const OY = 218;
const SCALE = 4; // output is W/4 × H/4

const PALETTE = {
  K: "#1a1410", // outline
  W: "#ffffff",
  w: "#e5e7eb",
  B: "#3b82f6",
  b: "#93c5fd",
  D: "#1e3a8a",
  Y: "#fde047",
  O: "#f59e0b",
  R: "#ef4444",
  r: "#991b1b",
  G: "#6b7280",
  g: "#cbd5e1",
  d: "#334155",
  M: "#3b1b1c", // mouth brown (same as original features)
  P: "#f472b6",
  L: "#0f172a", // sunglasses lens
  l: "#64748b", // lens shine
  N: "#a16207", // magnifier handle
  F: "#fccf33", // face yellow
};

/** ASCII rows → SVG rects. '.' is transparent. */
function sprite(rows, x, y, unit) {
  let out = "";
  rows.forEach((row, ry) => {
    [...row].forEach((ch, rx) => {
      const fill = PALETTE[ch];
      if (fill) {
        out += `<rect x="${x + rx * unit}" y="${y + ry * unit}" width="${unit}" height="${unit}" fill="${fill}"/>`;
      }
    });
  });
  return out;
}

// ─── Sprites ──────────────────────────────────────────────────────────────

/** Left half + centre column → symmetric sprite (keeps the umbrella perfectly even). */
const mirror = (rows) => rows.map((r) => r + [...r.slice(0, -1)].reverse().join(""));

// Red/white panelled canopy with a shaded rim and scalloped edge.
const UMBRELLA = mirror([
  "........KKKKK",
  "......KKRWWRR",
  ".....KRRRWWRR",
  "....KRRRRWWRR",
  "...KRRRRWWWRR",
  "..KRRRRRWWWRR",
  "..KRRRRRWWWRR",
  ".KRRRRRWWWWRR",
  ".KRRRRRWWWWRR",
  "KRRRRRRWWWWRR",
  "Krrrrrrwwwwrr",
  ".KKK.KKKK.KKK",
]);

const RAINDROP = ["b", "B", "B", "B"];

const SUN = [
  ".......Y.......",
  "..Y....Y....Y..",
  "...Y.......Y...",
  ".....KKKKK.....",
  "....KOOOOOK....",
  "...KOYYYYYOK...",
  "...KOYYYYYOK...",
  "YY.KOYYYYYOK.YY",
  "...KOYYYYYOK...",
  "...KOYYYYYOK...",
  "....KOOOOOK....",
  ".....KKKKK.....",
  "...Y.......Y...",
  "..Y....Y....Y..",
  ".......Y.......",
];

const SWEAT = [".b.", "bBb", "BBB", ".B."];

const SUNGLASSES = [
  "KKKKKKKKKKKKKKKKKKKKKKKKKKKK",
  "KLLLLLLLLKKKKKKKKKKLLLLLLLLK",
  "KLlLLLLLLK........KLlLLLLLLK",
  "KLLlLLLLLK........KLLlLLLLLK",
  ".KLLLLLLK..........KLLLLLLK.",
  "..KKKKKK............KKKKKK..",
];

const STORM_CLOUD = [
  "....KKKKK.........",
  "...KdddddK.KKKK...",
  ".KKdddGddKKddddK..",
  "KddddGGddddddddddK",
  "KdddddddddddGddddK",
  ".KKKKKKKKKKKKKKKK.",
  "......KYYK........",
  ".....KYYK.........",
  "....KYYYYYK.......",
  "......KYYK........",
  ".....KYK..........",
  ".....KK...........",
];

const WARNING = [
  "....KK....",
  "...KYYK...",
  "...KYYK...",
  "..KYKKYK..",
  "..KYKKYK..",
  ".KYYKKYYK.",
  ".KYYYYYYK.",
  "KYYYKKYYYK",
  "KKKKKKKKKK",
];

const MAGNIFIER = [
  "..KKKKK...",
  ".KbbbbbK..",
  "KbWbbbbbK.",
  "KbWbbbbbK.",
  "KbbbbbbbK.",
  "KbbbbbbbK.",
  ".KbbbbbK..",
  "..KKKKKKK.",
  ".......KNK",
  "........KNK",
  ".........KNK",
  "..........KK",
];

const SPARKLE = [
  "...Y...",
  "...Y...",
  "..YWY..",
  "YYWWWYY",
  "..YWY..",
  "...Y...",
  "...Y...",
];

const MOON = [
  "....KKKK..",
  "..KKYYYYK.",
  ".KYYYYKK..",
  "KYYYYK....",
  "KYYYK.....",
  "KYYYK.....",
  "KYYYYK....",
  ".KYYYYKK..",
  "..KKYYYYK.",
  "....KKKK..",
];

const STAR = [".Y.", "YWY", ".Y."];

const ZZZ = ["KKKK", "..K.", ".K..", "KKKK"];

// Mouths (unit 12, centred on the original mouth)
const MOUTH_FROWN = [
  "...MMMMMM...",
  ".MM......MM.",
  "M..........M",
];
const MOUTH_O = [
  ".MMMM.",
  "MrrrrM",
  "MrrrrM",
  "MrrrrM",
  ".MMMM.",
];
const MOUTH_BIG_SMILE = [
  "MM........MM",
  "MMMMMMMMMMMM",
  ".MrrrrrrrrM.",
  "..MrrPPrrM..",
  "...MMMMMM...",
];
// Eyes (unit 12, centred on the original eyes)
const EYE_HAPPY = [ // ^ ^ squint
  "..MMMM..",
  ".MM..MM.",
  "MM....MM",
];
const EYE_SLEEPY = [ // closed, curved down, with lashes
  "M......M",
  "MM....MM",
  ".MMMMMM.",
  "..M..M..",
];
// Worried brows: inner ends raised
const BROW_WORRIED_L = [
  "......MM",
  "....MM..",
  "..MM....",
  "MM......",
];
const BROW_WORRIED_R = BROW_WORRIED_L.map((r) => [...r].reverse().join(""));

const MOUTH_WAVY = [
  ".MM...MM...MM.",
  "M..M.M..M.M..M",
];

// ─── Pixel-level face edits ───────────────────────────────────────────────

const ORIGINAL_MOUTH = { x0: 430, x1: 552, y0: 560, y1: 604 };
// Feature boxes in source-image coordinates
const FEATURES = {
  mouth: [ORIGINAL_MOUTH],
  eyes: [
    { x0: 326, x1: 422, y0: 452, y1: 552 },
    { x0: 543, x1: 634, y0: 452, y1: 552 },
  ],
  brows: [
    { x0: 325, x1: 405, y0: 398, y1: 446 },
    { x0: 558, x1: 626, y0: 398, y1: 446 },
  ],
};
const FACE_RGB = [0xfc, 0xcf, 0x33];

/** Feature pixels: brown/black incl. anti-aliased edges (red < 205) or white highlights (high blue). Orange kernel lines (red > 205) stay. */
const isFeaturePixel = (r, g, b) => r < 205 || b > 110;

/** Source image with the given features ("mouth" | "eyes" | "brows") painted over in face yellow. */
async function loadBaseWithout(features) {
  const { data, info } = await sharp(SRC).raw().toBuffer({ resolveWithObject: true });
  const buf = Buffer.from(data);
  for (const f of features) {
    for (const { x0, x1, y0, y1 } of FEATURES[f]) {
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const i = (y * info.width + x) * 4;
          if (buf[i + 3] > 200 && isFeaturePixel(buf[i], buf[i + 1], buf[i + 2])) {
            buf[i] = FACE_RGB[0];
            buf[i + 1] = FACE_RGB[1];
            buf[i + 2] = FACE_RGB[2];
          }
        }
      }
    }
  }
  return sharp(buf, { raw: info }).png().toBuffer();
}

// Mouth centre in canvas coordinates
const MOUTH_CX = OX + (ORIGINAL_MOUTH.x0 + ORIGINAL_MOUTH.x1) / 2;
const MOUTH_CY = OY + (ORIGINAL_MOUTH.y0 + ORIGINAL_MOUTH.y1) / 2;
const EYES_Y = OY + 462; // top of the eyes (orig ~462)
const EYES_X = OX + 330;
const RIGHT_HAND = { x: OX + 775, y: OY + 600 };

/** Sprite centred on a canvas point. */
function centred(rows, cx, cy, unit) {
  const w = rows[0].length * unit;
  const h = rows.length * unit;
  return sprite(rows, Math.round(cx - w / 2), Math.round(cy - h / 2), unit);
}

function mouth(rows, unit = 12) {
  return centred(rows, MOUTH_CX, MOUTH_CY, unit);
}

// Eye / brow centres in canvas coordinates
const EYE_L = { x: OX + 372, y: OY + 502 };
const EYE_R = { x: OX + 590, y: OY + 502 };
const BROW_L = { x: OX + 366, y: OY + 422 };
const BROW_R = { x: OX + 592, y: OY + 422 };

function eyes(rows, unit = 12) {
  return centred(rows, EYE_L.x, EYE_L.y, unit) + centred(rows, EYE_R.x, EYE_R.y, unit);
}

function worriedBrows(unit = 11) {
  return centred(BROW_WORRIED_L, BROW_L.x, BROW_L.y, unit) + centred(BROW_WORRIED_R, BROW_R.x, BROW_R.y, unit);
}

/** Soft ground shadow under the feet, drawn behind Maisy. */
const SHADOW = `<ellipse cx="${OX + 450}" cy="${OY + 1176}" rx="300" ry="34" fill="#0f172a" fill-opacity="0.16"/>`;

let maisyAlpha = null; // set in main(): { data, width, height }

/** True if the canvas point is on Maisy (non-transparent pixel), with margin. */
function onMaisy(cx, cy, margin = 24) {
  if (!maisyAlpha) return false;
  for (const [dx, dy] of [[0, 0], [margin, 0], [-margin, 0], [0, margin], [0, -margin]]) {
    const x = cx + dx - OX;
    const y = cy + dy - OY;
    if (x < 0 || y < 0 || x >= maisyAlpha.width || y >= maisyAlpha.height) continue;
    if (maisyAlpha.data[(y * maisyAlpha.width + x) * 4 + 3] > 20) return true;
  }
  return false;
}

function rain(seed, count, shelter = null) {
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  let out = "";
  for (let i = 0; i < count; i++) {
    const x = Math.round((rnd() * (W - 40)) / 16) * 16;
    const y = Math.round((40 + rnd() * (H - 120)) / 16) * 16;
    if (onMaisy(x + 7, y + 20)) continue;
    if (shelter && x > shelter.x0 && x < shelter.x1 && y > shelter.y0) continue;
    out += sprite(RAINDROP, x, y, 14);
  }
  return out;
}

/** Pixel-stepped straight line (for the tilted umbrella pole). */
function pixelLine(x0, y0, x1, y1, unit, color = "K") {
  const steps = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) / unit);
  let out = "";
  for (let i = 0; i <= steps; i++) {
    const x = Math.round((x0 + ((x1 - x0) * i) / steps) / unit) * unit;
    const y = Math.round((y0 + ((y1 - y0) * i) / steps) / unit) * unit;
    out += sprite([color], x, y, unit);
  }
  return out;
}

/**
 * Umbrella held in Maisy's right hand, tilted over her head. Built upright
 * (pole straight down from the canopy centre to the grip) then rotated about
 * the grip, so canopy and pole always line up. The pole goes behind Maisy
 * (her hand covers the grip) and the canopy in front, over her hat.
 * Returns { back, front } SVG fragments.
 */
function heldUmbrella({ unit = 20, length = 620, angle = -25 } = {}) {
  const g = { x: RIGHT_HAND.x + 22, y: RIGHT_HAND.y + 20 };
  const w = UMBRELLA[0].length * unit;
  const h = UMBRELLA.length * unit;
  const top = g.y - length - h + unit; // last canopy row overlaps the pole top
  // Rects overlap by 1px so rotation leaves no hairline seams.
  let canopy = "";
  UMBRELLA.forEach((row, ry) =>
    [...row].forEach((ch, rx) => {
      if (PALETTE[ch]) {
        canopy += `<rect x="${g.x - w / 2 + rx * unit}" y="${top + ry * unit}" width="${unit + 1}" height="${unit + 1}" fill="${PALETTE[ch]}"/>`;
      }
    }),
  );
  const K = PALETTE.K;
  const tip = `<rect x="${g.x - 7}" y="${top - 26}" width="14" height="30" fill="${K}"/>`;
  const pole =
    `<rect x="${g.x - 10}" y="${g.y - length}" width="20" height="${length + 40}" fill="${K}"/>` +
    `<rect x="${g.x - 4}" y="${g.y - length}" width="8" height="${length + 34}" fill="${PALETTE.N}"/>`;
  const hook = `<path d="M ${g.x} ${g.y + 36} v 24 a 30 30 0 0 1 -60 0" stroke="${K}" stroke-width="18" fill="none"/>`;
  const group = (inner) =>
    `<g transform="rotate(${angle} ${g.x} ${g.y})" shape-rendering="geometricPrecision">${inner}</g>`;
  return { back: group(pole + hook), front: group(tip + canopy) };
}

// ─── Moods ────────────────────────────────────────────────────────────────

const MOODS = {
  default: { erase: [], svg: () => "" },

  happy: {
    erase: ["mouth", "eyes"],
    svg: () =>
      eyes(EYE_HAPPY) +
      mouth(MOUTH_BIG_SMILE) +
      sprite(SPARKLE, 60, 260, 18) +
      sprite(SPARKLE, 930, 300, 22) +
      sprite(SPARKLE, 980, 900, 16) +
      sprite(SPARKLE, 40, 760, 14),
  },

  // Falling rain is animated in CSS (MaisyGreeting), so none is baked in here.
  rain: {
    erase: [],
    back: () => heldUmbrella().back,
    svg: () => heldUmbrella().front,
  },

  storm: {
    erase: ["mouth", "brows"],
    svg: () =>
      worriedBrows() +
      sprite(STORM_CLOUD, 10, 10, 30) +
      sprite(WARNING, 860, 120, 24) +
      mouth(MOUTH_O) +
      sprite(SWEAT, OX + 640, OY + 380, 16),
  },

  hot: {
    erase: ["mouth"],
    svg: () =>
      sprite(SUN, 790, 10, 22) +
      sprite(SUNGLASSES, EYES_X - 6, EYES_Y + 6, 11) +
      mouth(MOUTH_WAVY, 10) +
      sprite(SWEAT, OX + 230, OY + 360, 16) +
      sprite(SWEAT, OX + 660, OY + 330, 14),
  },

  sick: {
    erase: ["mouth", "brows"],
    svg: () =>
      worriedBrows() +
      mouth(MOUTH_FROWN) +
      sprite(SWEAT, OX + 640, OY + 370, 16) +
      sprite(MAGNIFIER, RIGHT_HAND.x - 70, RIGHT_HAND.y - 260, 26) +
      sprite(WARNING, 70, 150, 22),
  },

  night: {
    erase: ["eyes"],
    svg: () =>
      eyes(EYE_SLEEPY) +
      sprite(MOON, 860, 40, 26) +
      sprite(STAR, 120, 120, 20) +
      sprite(STAR, 700, 60, 16) +
      sprite(STAR, 1020, 420, 18) +
      sprite(STAR, 60, 520, 14) +
      sprite(ZZZ, 760, 300, 20) +
      sprite(ZZZ, 860, 230, 14),
  },
};

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const bases = new Map(); // erase-list key -> base PNG buffer
  const baseFor = async (erase) => {
    const key = erase.join(",");
    if (!bases.has(key)) bases.set(key, await loadBaseWithout(erase));
    return bases.get(key);
  };
  const raw = await sharp(SRC).raw().toBuffer({ resolveWithObject: true });
  maisyAlpha = { data: raw.data, width: raw.info.width, height: raw.info.height };

  for (const [name, mood] of Object.entries(MOODS)) {
    const svg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" shape-rendering="crispEdges">${mood.svg()}</svg>`,
    );
    const out = path.join(OUT_DIR, `maisy-${name}.png`);
    const full = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([
        { input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${SHADOW}${mood.back ? mood.back() : ""}</svg>`), left: 0, top: 0 },
        { input: await baseFor(mood.erase), left: OX, top: OY },
        { input: svg, left: 0, top: 0 },
      ])
      .png()
      .toBuffer();
    // Shown ~130px tall: an exact 1/SCALE nearest-neighbour shrink keeps the
    // pixel art crisp (still 2x+ for sharp phone screens) at a fraction of the size.
    await sharp(full)
      .resize(Math.round(W / SCALE), Math.round(H / SCALE), { kernel: "nearest" })
      .png({ compressionLevel: 9, palette: true })
      .toFile(out);
    console.log("wrote", path.relative(ROOT, out));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

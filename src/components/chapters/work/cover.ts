// Project covers drawn in squares on a lattice. Used until a project has a
// real cover image.
//
// A project with pixel art in art.ts gets that, placed on the lattice. Any
// other project gets an abstract composition worked out from its slug, so the
// same project always gets the same picture. A composition is described in
// "unit space" (height 1, width = cols / rows) and then sampled once per
// lattice cell, so it can be drawn at any resolution: coarse in the hover
// preview, finer on the case study page.
import { clamp, rng } from "@/lib/motion";
import { COVER_ART, type Bitmap } from "./art";

export type CoverSquare = {
  col: number;
  row: number;
  /** Size step, 1 (a speck) to 4 (a full square). */
  level: 1 | 2 | 3 | 4;
  /** When the square lands while the cover assembles, 0 (first) to 1 (last). */
  order: number;
};

/** Edge of a square at each size step, as a share of its lattice cell. Step 4 matches the site's squares. */
export const COVER_SIZES = [0, 0.26, 0.44, 0.62, 0.8] as const;

/** How dark a point is: 0 is empty paper, 1 is a full square. */
type Field = (u: number, v: number, col: number, row: number) => number;
/** Shading inside a shape, in the shape's own coordinates (-1 to 1 on both axes). */
type Shade = (x: number, y: number, col: number, row: number) => number;
type Layer = {
  field: Field;
  /** "over" paints on top; "cut" leaves the difference where two shapes overlap. */
  blend: "over" | "cut";
};

const TAU = Math.PI * 2;

const solid: Shade = () => 1;

/** A ramp across the shape, lightest where the angle points away from. */
const fade = (angle: number, low = 0.15): Shade => {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  return (x, y) => low + (1 - low) * clamp((x * dx + y * dy) * 0.5 + 0.5);
};

/** Dense in the middle, thinning toward the edge. */
const core = (low = 0.15): Shade => (x, y) => Math.max(low, 1 - (1 - low) * Math.hypot(x, y));

/** Every other lattice row or column. */
const ruled = (axis: "row" | "col", period = 2): Shade => (_x, _y, col, row) =>
  (axis === "row" ? row : col) % period === 0 ? 1 : 0;

const disc = (cx: number, cy: number, r: number, shade: Shade): Field => (u, v, col, row) => {
  const x = (u - cx) / r;
  const y = (v - cy) / r;
  return x * x + y * y > 1 ? 0 : shade(x, y, col, row);
};

const rect = (x0: number, y0: number, x1: number, y1: number, shade: Shade): Field => (u, v, col, row) =>
  u < x0 || u >= x1 || v < y0 || v >= y1
    ? 0
    : shade(((u - x0) / (x1 - x0)) * 2 - 1, ((v - y0) / (y1 - y0)) * 2 - 1, col, row);

type Random = () => number;
const between = (r: Random, min: number, max: number) => min + (max - min) * r();
const pick = <T>(r: Random, items: readonly T[]) => items[Math.floor(r() * items.length)];
const QUARTERS = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2] as const;

// The compositions. Each takes the generator and the width of the canvas in
// unit space, and returns its layers from back to front.

/** A disc over a horizon. */
function sun(r: Random, w: number): Layer[] {
  const horizon = between(r, 0.68, 0.8);
  const radius = between(r, 0.2, 0.29);
  const cx = w * between(r, 0.28, 0.72);
  const cy = horizon - radius * between(r, 0.55, 1.25);
  const ground = pick(r, [ruled("row"), fade(Math.PI / 2, 0.2), fade(pick(r, [0, Math.PI]), 0.1)]);
  const face = pick(r, [core(0.2), fade(between(r, 0, TAU)), fade(-Math.PI / 2, 0.3)]);
  return [
    { field: rect(0, horizon, w, 1, ground), blend: "over" },
    { field: disc(cx, cy, radius, face), blend: "cut" },
  ];
}

/** Ridges fading into mist, nearest last. */
function hills(r: Random, w: number): Layer[] {
  const count = r() < 0.5 ? 2 : 3;
  const layers: Layer[] = [];
  if (r() < 0.7) {
    const radius = between(r, 0.09, 0.13);
    layers.push({ field: disc(w * between(r, 0.15, 0.85), between(r, 0.16, 0.24), radius, solid), blend: "over" });
  }
  for (let i = 0; i < count; i++) {
    const base = 0.4 + (i * 0.42) / count + between(r, -0.03, 0.03);
    const swell = between(r, 0.07, 0.13);
    const rate = (TAU / w) * between(r, 0.7, 1.5);
    const phase = between(r, 0, TAU);
    const depth = between(r, 0.26, 0.4);
    layers.push({
      blend: "over",
      field: (u, v) => {
        const ridge = base + swell * Math.sin(u * rate + phase) + swell * 0.4 * Math.sin(u * rate * 2.3 + phase * 1.7);
        const below = v - ridge;
        // Below a ridge the ink thins to specks but never quite clears, like mist.
        return below < 0 ? 0 : Math.max(0.1, 1 - below / depth);
      },
    });
  }
  return layers;
}

/** A staircase with one loose block. */
function stairs(r: Random, w: number): Layer[] {
  const steps = pick(r, [4, 5, 6]);
  const mirrored = r() < 0.5;
  const shade = pick(r, [fade(mirrored ? Math.PI : 0, 0.1), fade(Math.PI / 2, 0.2), fade(-Math.PI / 2, 0.25)]);
  const rise = between(r, 0.62, 0.8);
  const size = between(r, 0.14, 0.2);
  const bx = mirrored ? w * between(r, 0.62, 0.8) : w * between(r, 0.08, 0.26);
  const by = between(r, 0.12, 0.26);
  return [
    {
      blend: "over",
      field: (u, v, col, row) => {
        const along = mirrored ? 1 - u / w : u / w;
        const step = Math.min(steps - 1, Math.floor(along * steps));
        const top = 0.94 - ((step + 1) / steps) * rise;
        return v < top ? 0 : shade(along * 2 - 1, ((v - top) / (1 - top)) * 2 - 1, col, row);
      },
    },
    { field: rect(bx, by, bx + size, by + size, solid), blend: "over" },
  ];
}

/** Three rectangles on a coarse grid, cutting into each other. */
function blocks(r: Random, w: number): Layer[] {
  const gx = w / 6;
  const gy = 1 / 4;
  const shades = [fade(pick(r, QUARTERS), 0.12), ruled(pick(r, ["row", "col"] as const)), solid];
  // Shuffle so each rectangle gets a different treatment.
  for (let i = shades.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [shades[i], shades[j]] = [shades[j], shades[i]];
  }
  const ax = Math.floor(between(r, 0, 2));
  const ay = Math.floor(between(r, 0, 2));
  const aw = 3;
  const ah = Math.floor(between(r, 2, 4));
  const bx = ax + Math.floor(between(r, 1, 3));
  const by = Math.min(3, ay + 1);
  const bw = Math.min(6 - bx, Math.floor(between(r, 2, 4)));
  const bh = Math.min(4 - by, 2);
  const cx = r() < 0.5 ? 5 : ax > 0 ? 0 : 4;
  const cy = by > 1 ? 0 : 3;
  return [
    { field: rect(ax * gx, ay * gy, (ax + aw) * gx, Math.min(4, ay + ah) * gy, shades[0]), blend: "over" },
    { field: rect(bx * gx, by * gy, (bx + bw) * gx, (by + bh) * gy, shades[1]), blend: "cut" },
    { field: rect(cx * gx, cy * gy, (cx + 1) * gx, (cy + 1) * gy, shades[2]), blend: "cut" },
  ];
}

/** Two discs crossing, leaving only where they differ. */
function eclipse(r: Random, w: number): Layer[] {
  const radius = between(r, 0.26, 0.33);
  const cx = w * between(r, 0.4, 0.6);
  const cy = between(r, 0.45, 0.55);
  const angle = between(r, 0, TAU);
  const apart = radius * between(r, 0.55, 0.95);
  const dx = (Math.cos(angle) * apart) / 2;
  const dy = (Math.sin(angle) * apart) / 2;
  const first = pick(r, [fade(angle + Math.PI, 0.2), fade(angle + Math.PI / 2, 0.2), solid]);
  return [
    { field: disc(cx - dx, cy - dy, radius, first), blend: "over" },
    { field: disc(cx + dx, cy + dy, radius * between(r, 0.8, 1), solid), blend: "cut" },
  ];
}

/** A ramp that thins out to nothing across the canvas, with a disc that inverts whatever it covers. */
function field(r: Random, w: number): Layer[] {
  const angle = pick(r, [0, Math.PI, Math.PI / 4, (3 * Math.PI) / 4, -Math.PI / 4, (-3 * Math.PI) / 4]);
  const ramp = fade(angle, -0.8);
  const radius = between(r, 0.22, 0.3);
  return [
    { field: rect(0, 0, w, 1, (x, y, col, row) => ramp(x, y, col, row) * 0.75), blend: "over" },
    { field: disc(w * between(r, 0.32, 0.68), between(r, 0.4, 0.6), radius, solid), blend: "cut" },
  ];
}

const COMPOSITIONS = [sun, hills, stairs, blocks, eclipse, field] as const;

/** FNV-1a: a stable number for a string. */
function hash(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Size step of each character in a bitmap. Anything else is an empty cell. */
const ART_LEVELS: Record<string, CoverSquare["level"]> = { "#": 4, "=": 3, "+": 2, "-": 1 };

/**
 * A project's pixel art on a lattice of `cols` by `rows` cells: the largest of
 * its bitmaps that fits, scaled up by whole cells while it still fits, and
 * centred. Null when the project has no art or none of it fits.
 */
function artSquares(slug: string, cols: number, rows: number): CoverSquare[] | null {
  const fits = (b: Bitmap) => b.length <= rows && b[0].length <= cols;
  const bitmap = (COVER_ART[slug] ?? [])
    .filter(fits)
    .reduce<Bitmap | null>((best, b) => (!best || b.length * b[0].length > best.length * best[0].length ? b : best), null);
  if (!bitmap) return null;

  const w = bitmap[0].length;
  const h = bitmap.length;
  const scale = Math.max(1, Math.floor(Math.min(cols / w, rows / h)));
  const left = Math.floor((cols - w * scale) / 2);
  const top = Math.floor((rows - h * scale) / 2);
  const scatter = rng(hash(slug) ^ 0x9e3779b9);

  const squares: CoverSquare[] = [];
  bitmap.forEach((line, y) => {
    for (let x = 0; x < w; x++) {
      const level = ART_LEVELS[line[x]];
      if (!level) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const col = left + x * scale + dx;
          const row = top + y * scale + dy;
          // Art assembles left to right, the way it reads: the shuttle's path in
          // flight order, the wordmark letter by letter, the chain block by block.
          squares.push({ col, row, level, order: clamp((col / cols) * 0.8 + (row / rows) * 0.08 + scatter() * 0.12) });
        }
      }
    }
  });
  return squares;
}

/** The squares of a project's cover on a lattice of `cols` by `rows` cells. */
export function coverSquares(slug: string, cols: number, rows: number): CoverSquare[] {
  const art = artSquares(slug, cols, rows);
  if (art) return art;

  const seed = hash(slug);
  const r = rng(seed);
  const width = cols / rows;
  const layers = COMPOSITIONS[seed % COMPOSITIONS.length](r, width);

  // The wave the squares arrive in: across the canvas from one corner.
  const fromRight = r() < 0.5;
  const fromBottom = r() < 0.5;
  const scatter = rng(seed ^ 0x9e3779b9);

  const squares: CoverSquare[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const u = (col + 0.5) / rows;
      const v = (row + 0.5) / rows;
      let value = 0;
      for (const layer of layers) {
        const t = layer.field(u, v, col, row);
        if (t <= 0) continue;
        value = layer.blend === "cut" && value > 0 ? Math.abs(value - t) : t;
      }
      const level = Math.min(4, Math.ceil(value * 4 - 0.001));
      if (level < 1) continue;
      const x = fromRight ? 1 - col / cols : col / cols;
      const y = fromBottom ? 1 - row / rows : row / rows;
      squares.push({
        col,
        row,
        level: level as CoverSquare["level"],
        order: clamp((x + y) * 0.4 + scatter() * 0.2),
      });
    }
  }
  return squares;
}

// Stroke-order data for the handful of characters the site draws from squares.
// Source: hanzi-writer-data 2.0.1 (Make Me a Hanzi, Arphic Public License).
// Coordinates sit in a 1024-unit box with y pointing up; on screen,
// y = 900 - dataY.
import data from "./strokes.json";

export type GlyphData = {
  /** One SVG path per stroke, in writing order. */
  strokes: string[];
  /** One centre line per stroke: the path the brush follows. */
  medians: number[][][];
};

const glyphs = data as Record<string, GlyphData>;

export function glyph(char: string): GlyphData {
  const g = glyphs[char];
  if (!g) throw new Error(`No stroke data for ${char}. Add it to src/lib/hanzi/strokes.json.`);
  return g;
}

export const GLYPH_BOX = 1024;
export const GLYPH_BASELINE = 900;

/** The seal reads right column first, top to bottom: 付 优, then 扬 印. */
export const SEAL_GRID = [
  ["扬", "付"],
  ["印", "优"],
] as const;

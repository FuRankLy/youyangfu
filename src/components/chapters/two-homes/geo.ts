// The geometry of the square map: where things sit on the lattice. Pure data
// and functions with no DOM, so a scroll scene can drive the same numbers later.
//
// Everything is measured in lattice units: x in columns from the west edge, y in
// rows from the north edge. One unit is one cell; multiply by the cell size to
// get pixels.
import { landGrid } from "@/content/land-grid";
import { site } from "@/content/site";
import { clamp, ease, lerp } from "@/lib/motion";

export type Point = { x: number; y: number };
export type Cell = { col: number; row: number };
/** A quadratic curve. */
export type Curve = { from: Point; control: Point; to: Point };

export const COLS = landGrid.cols;
export const ROWS = landGrid.rows;
/** Row of the equator. The frame is symmetric, so it falls on a cell boundary. */
export const EQUATOR = (landGrid.north / (landGrid.north - landGrid.south)) * ROWS;

const degreesPerCell = (landGrid.east - landGrid.west) / COLS;

/** Equirectangular projection of a longitude and latitude into lattice units. */
export function project(lon: number, lat: number): Point {
  // The frame runs past 180°E, so a longitude west of it may belong on the far side.
  const wrapped = lon < landGrid.west && lon + 360 <= landGrid.east ? lon + 360 : lon;
  return { x: (wrapped - landGrid.west) / degreesPerCell, y: (landGrid.north - lat) / degreesPerCell };
}

export const cellAt = (point: Point): Cell => ({ col: Math.floor(point.x), row: Math.floor(point.y) });
export const centreOf = (cell: Cell): Point => ({ x: cell.col + 0.5, y: cell.row + 0.5 });

/** Every land cell, north to south, west to east. */
export const landCells: Cell[] = landGrid.cells.flatMap((line, row) =>
  Array.from(line).flatMap((mark, col) => (mark === "#" ? [{ col, row }] : [])),
);

const { hometown, home } = site.places;
const hometownCell = cellAt(project(hometown.lon, hometown.lat));
const homeCell = cellAt(project(home.lon, home.lat));
const from = centreOf(hometownCell);
const to = centreOf(homeCell);

// The flight is drawn as one curve that bows out over the open Pacific, clear
// of the land on the direct line. Phase 2 can swap in a true great circle.
const BOW = 0.28;
const control: Point = {
  x: (from.x + to.x) / 2 + (to.y - from.y) * BOW,
  y: (from.y + to.y) / 2 - (to.x - from.x) * BOW,
};

const DIAGONAL = Math.SQRT1_2;

/** The story marks. Cities snap to the lattice like everything else. */
export const marks = {
  hometown: { cell: hometownCell, at: from },
  home: { cell: homeCell, at: to },
  flight: { from, control, to } satisfies Curve,
  /** How far along the flight the travelling square rests. */
  riderAt: 0.75,
  /** Zhengzhou's rail lines: eight directions, like the strokes of the character for rice. */
  rails: [
    { x: 1, y: 0 },
    { x: DIAGONAL, y: DIAGONAL },
    { x: 0, y: 1 },
    { x: -DIAGONAL, y: DIAGONAL },
    { x: -1, y: 0 },
    { x: -DIAGONAL, y: -DIAGONAL },
    { x: 0, y: -1 },
    { x: DIAGONAL, y: -DIAGONAL },
  ] as Point[],
  /** Length of each rail stroke, in cells. */
  railLength: 2.25,
  /**
   * The row boundary just north of Auckland's cell. Once the map is mirrored,
   * Zhengzhou's square rests directly above this line and Auckland's real
   * position directly below it.
   */
  homeParallel: homeCell.row,
};

export function curvePoint(curve: Curve, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * curve.from.x + 2 * u * t * curve.control.x + t * t * curve.to.x,
    y: u * u * curve.from.y + 2 * u * t * curve.control.y + t * t * curve.to.y,
  };
}

/** The first `t` of a curve, as a curve of its own. */
export function curveStart(curve: Curve, t: number): Curve {
  return {
    from: curve.from,
    control: { x: lerp(curve.from.x, curve.control.x, t), y: lerp(curve.from.y, curve.control.y, t) },
    to: curvePoint(curve, t),
  };
}

// --- Flipping the world ------------------------------------------------------
// The flip mirrors the map across the equator. It sweeps west to east: each
// column sets off a little after the one before, and travels on the flight curve.

/** Share of the flip spent on the sweep. The same spread as the opening's morph. */
const FLIP_SPREAD = 0.3;

/**
 * How far something at column `x` has flipped (0 as drawn, 1 mirrored) when the
 * whole flip is at `progress` (0 to 1, linear in time).
 */
export function flipAt(progress: number, x: number) {
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;
  return ease.flight(clamp(progress * (1 + FLIP_SPREAD) - FLIP_SPREAD * clamp(x / COLS)));
}

/** A row position on its way to its mirror image across the equator. */
export const mirrorRow = (y: number, amount: number) => lerp(y, 2 * EQUATOR - y, amount);

/** A point at column x, flipped as far as its column has got. */
export const flipPoint = (point: Point, progress: number): Point => ({
  x: point.x,
  y: mirrorRow(point.y, flipAt(progress, point.x)),
});

export const flipCurve = (curve: Curve, progress: number): Curve => ({
  from: flipPoint(curve.from, progress),
  control: flipPoint(curve.control, progress),
  to: flipPoint(curve.to, progress),
});

// Draws one frame of the square map onto a canvas. It knows nothing about
// React, the DOM around it or time: give it a layout, colours and a scene, and
// it paints. The still frame and (later) the scroll scene use the same call.
import {
  COLS,
  EQUATOR,
  curvePoint,
  curveStart,
  flipAt,
  flipCurve,
  flipPoint,
  landCells,
  marks,
  mirrorRow,
  type Point,
} from "./geo";

export type MapLayout = {
  /** Cell size in CSS pixels. Always a whole number of device pixels, so the lattice stays crisp. */
  cell: number;
  /** Device pixels per CSS pixel. */
  dpr: number;
};

export type MapColors = {
  land: string;
  ink: string;
  accent: string;
  /** Dashed reference lines. */
  rule: string;
};

/** Everything that can change from frame to frame. All values run 0 to 1. */
export type MapScene = {
  /** Progress of the mirror across the equator, linear in time. */
  flip: number;
  /** How far Zhengzhou's rail lines have drawn out. */
  rails: number;
  /** How much of the flight path is drawn. */
  flight: number;
  /** Where the travelling square sits along the flight path. */
  rider: number;
  /** Opacity of Auckland's real latitude and position, shown once the map is flipped. */
  parallel: number;
};

/** The resting frame: everything drawn, nothing flipped. */
export const restingScene: MapScene = { flip: 0, rails: 1, flight: 1, rider: marks.riderAt, parallel: 0 };

/** Pointer position in CSS pixels from the canvas's top left. `strength` fades the effect in and out. */
export type MapPointer = { x: number; y: number; strength: number };

/** A square fills this much of its cell, as in the opening. */
const SQUARE = 0.8;
/** How much a square right under the pointer grows. */
const GROW = 0.3;
/** City squares never get smaller than this, in CSS pixels, however fine the lattice. */
const MIN_MARK = 6;
const MIN_RIDER = 4.5;

export function drawMap(
  ctx: CanvasRenderingContext2D,
  layout: MapLayout,
  colors: MapColors,
  scene: MapScene,
  pointer: MapPointer | null,
  /** Cells to leave out, indexed row * COLS + col. Used to clear room for labels. */
  hidden: Uint8Array | null,
) {
  const { cell, dpr } = layout;
  const unit = Math.round(cell * dpr); // device pixels per cell
  const width = ctx.canvas.width;
  const hair = Math.max(1, Math.round(dpr));

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, ctx.canvas.height);
  ctx.globalAlpha = 1;

  dashedRule(ctx, EQUATOR * unit, width, hair, dpr, colors.rule);

  // --- Land ---
  const amounts = new Float32Array(COLS);
  for (let col = 0; col < COLS; col++) amounts[col] = flipAt(scene.flip, col + 0.5);

  const base = unit * SQUARE;
  const resting = Math.round(base);
  const reach = Math.max(96, cell * 13) * dpr;
  const px = pointer ? pointer.x * dpr : 0;
  const py = pointer ? pointer.y * dpr : 0;
  const pull = pointer ? pointer.strength : 0;
  const { hometown, home } = marks;

  ctx.fillStyle = colors.land;
  for (const { col, row } of landCells) {
    if (hidden && hidden[row * COLS + col]) continue;
    if ((col === hometown.cell.col && row === hometown.cell.row) || (col === home.cell.col && row === home.cell.row)) continue;
    const x = (col + 0.5) * unit;
    const y = mirrorRow(row + 0.5, amounts[col]) * unit;
    let size = resting;
    if (pull > 0.001) {
      const dx = x - px;
      const dy = y - py;
      const d2 = dx * dx + dy * dy;
      if (d2 < reach * reach) {
        const k = 1 - Math.sqrt(d2) / reach;
        size = Math.round(base * (1 + GROW * k * k * pull));
      }
    }
    ctx.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), size, size);
  }

  // City squares are a full cell, and never too small to find.
  let mark = Math.max(unit, Math.round(MIN_MARK * dpr));
  if ((mark - unit) % 2) mark += 1; // stay centred on the cell

  // --- Where Auckland really is, for comparison once the map is flipped ---
  if (scene.parallel > 0.001) {
    ctx.globalAlpha = scene.parallel;
    dashedRule(ctx, marks.homeParallel * unit, width, hair, dpr, colors.rule);
    hollowSquare(ctx, home.at.x * unit, home.at.y * unit, mark, hair, colors.ink);
    ctx.globalAlpha = 1;
  }

  // --- Rail lines out of Zhengzhou ---
  const origin = scale(flipPoint(hometown.at, scene.flip), unit);
  if (scene.rails > 0) {
    const length = marks.railLength * scene.rails * unit;
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = Math.min(2, Math.max(1.25, cell * 0.17)) * dpr;
    ctx.lineCap = "butt";
    ctx.beginPath();
    for (const direction of marks.rails) {
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(origin.x + direction.x * length, origin.y + direction.y * length);
    }
    ctx.stroke();
  }

  // --- The flight ---
  const flight = flipCurve(marks.flight, scene.flip);
  if (scene.flight > 0) {
    const drawn = scene.flight >= 1 ? flight : curveStart(flight, scene.flight);
    const from = scale(drawn.from, unit);
    const control = scale(drawn.control, unit);
    const to = scale(drawn.to, unit);
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = 1.25 * dpr;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.quadraticCurveTo(control.x, control.y, to.x, to.y);
    ctx.stroke();

    if (scene.rider <= scene.flight) {
      const rider = scale(curvePoint(flight, scene.rider), unit);
      const size = Math.max(resting, Math.round(MIN_RIDER * dpr));
      ctx.fillStyle = colors.ink;
      ctx.fillRect(Math.round(rider.x - size / 2), Math.round(rider.y - size / 2), size, size);
    }
  }

  // --- The two cities ---
  ctx.fillStyle = colors.accent;
  ctx.fillRect(Math.round(origin.x - mark / 2), Math.round(origin.y - mark / 2), mark, mark);
  const landing = scale(flipPoint(home.at, scene.flip), unit);
  ctx.fillStyle = colors.ink;
  ctx.fillRect(Math.round(landing.x - mark / 2), Math.round(landing.y - mark / 2), mark, mark);
}

const scale = (point: Point, unit: number): Point => ({ x: point.x * unit, y: point.y * unit });

/** A dashed hairline across the whole canvas, drawn as rectangles so it lands on whole pixels. */
function dashedRule(
  ctx: CanvasRenderingContext2D,
  y: number,
  width: number,
  thickness: number,
  dpr: number,
  color: string,
) {
  const dash = Math.max(2, Math.round(4 * dpr));
  const top = Math.round(y) - Math.floor(thickness / 2);
  ctx.fillStyle = color;
  for (let x = 0; x < width; x += dash * 2) ctx.fillRect(x, top, dash, thickness);
}

function hollowSquare(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  thickness: number,
  color: string,
) {
  const left = Math.round(cx - size / 2);
  const top = Math.round(cy - size / 2);
  ctx.fillStyle = color;
  ctx.fillRect(left, top, size, thickness);
  ctx.fillRect(left, top + size - thickness, size, thickness);
  ctx.fillRect(left, top + thickness, thickness, size - 2 * thickness);
  ctx.fillRect(left + size - thickness, top + thickness, thickness, size - 2 * thickness);
}

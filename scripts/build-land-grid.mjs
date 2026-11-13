// Builds src/content/land-grid.ts: the land of the Asia-Pacific region as a
// lattice of cells, for the square map in the "Two homes" chapter.
//
//   node scripts/build-land-grid.mjs            write the module
//   node scripts/build-land-grid.mjs --preview  also print the grid
//
// It downloads the Natural Earth 1:110m land shapes (public domain) as TopoJSON,
// decodes the arcs, and marks a cell as land when enough of it is covered. The
// result is committed, so the site never fetches map data at runtime.
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE = "https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json";
const OUT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "src", "content", "land-grid.ts");

// The frame. It is symmetric about the equator, so mirroring the map maps rows
// onto rows, and it runs past 180°E, so longitudes are wrapped when sampling.
const WEST = 92;
const EAST = 188;
const NORTH = 52;
const SOUTH = -52;
const COLS = 72;
const CELL = (EAST - WEST) / COLS; // 1.333° per cell
const ROWS = Math.round((NORTH - SOUTH) / CELL);

// Each cell is tested at SAMPLES x SAMPLES points. A cell is land when at least
// COVER of them fall on land. Lower than a half, so that thin shapes (Japan, the
// Malay Peninsula, New Zealand) keep their outline at this resolution.
const SAMPLES = 6;
const COVER = 0.36;

// Small places the map must not lose. If one comes out with fewer cells than
// `min`, cells inside its box are admitted at a lower cover until it has enough.
const KEEP = [
  { name: "New Zealand, North Island", west: 172.5, east: 178.7, north: -34.3, south: -41.7, min: 9 },
  { name: "New Zealand, South Island", west: 166.3, east: 174.5, north: -40.4, south: -46.8, min: 9 },
];

const response = await fetch(SOURCE);
if (!response.ok) throw new Error(`Could not download ${SOURCE}: ${response.status}`);
const topology = await response.json();

// --- TopoJSON decoding -------------------------------------------------------
// Arcs are delta-encoded integer points; the transform turns them into degrees.
const { scale, translate } = topology.transform ?? { scale: [1, 1], translate: [0, 0] };
const arcs = topology.arcs.map((arc) => {
  let x = 0;
  let y = 0;
  return arc.map(([dx, dy]) => {
    x += dx;
    y += dy;
    return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
  });
});

/**
 * Joins a ring's arcs into one list of points. A negative index means the arc
 * runs backwards. The source stitches shapes across the antimeridian, so a ring
 * can jump from 179.9° to -179.9°; longitudes are unwrapped here to keep every
 * ring continuous (it may then run past 180°). Rings that circle a pole stay
 * open after this, which only matters south of 60°S, outside the frame.
 */
function ringPoints(indices) {
  const points = [];
  for (const index of indices) {
    const arc = index < 0 ? arcs[~index].slice().reverse() : arcs[index];
    points.push(...(points.length ? arc.slice(1) : arc).map(([x, y]) => [x, y]));
  }
  for (let i = 1; i < points.length; i++) {
    const step = points[i][0] - points[i - 1][0];
    if (step > 180) points[i][0] -= 360;
    else if (step < -180) points[i][0] += 360;
  }
  return points;
}

function collectRings(geometry, rings) {
  if (geometry.type === "GeometryCollection") for (const g of geometry.geometries) collectRings(g, rings);
  else if (geometry.type === "Polygon") for (const ring of geometry.arcs) rings.push(ringPoints(ring));
  else if (geometry.type === "MultiPolygon")
    for (const polygon of geometry.arcs) for (const ring of polygon) rings.push(ringPoints(ring));
}

const rings = [];
collectRings(topology.objects.land, rings);
const shapes = rings.map((points) => {
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  for (const [x, y] of points) {
    west = Math.min(west, x);
    east = Math.max(east, x);
    south = Math.min(south, y);
    north = Math.max(north, y);
  }
  return { points, west, east, south, north };
});

// --- Rasterising -------------------------------------------------------------
/**
 * Even-odd test over every ring, so holes need no special handling. The frame
 * crosses 180°E, so each ring is tried at the longitude as given and one turn
 * either side of it.
 */
function isLand(lon, lat) {
  let inside = false;
  for (const shape of shapes) {
    if (lat < shape.south || lat > shape.north) continue;
    for (const x of [lon, lon - 360, lon + 360]) {
      if (x < shape.west || x > shape.east) continue;
      const { points } = shape;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i];
        const [xj, yj] = points[j];
        if (yi > lat !== yj > lat && x < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
      }
    }
  }
  return inside;
}

const cover = [];
for (let row = 0; row < ROWS; row++) {
  const line = [];
  for (let col = 0; col < COLS; col++) {
    let hits = 0;
    for (let sy = 0; sy < SAMPLES; sy++) {
      for (let sx = 0; sx < SAMPLES; sx++) {
        const lon = WEST + (col + (sx + 0.5) / SAMPLES) * CELL;
        const lat = NORTH - (row + (sy + 0.5) / SAMPLES) * CELL;
        if (isLand(lon, lat)) hits++;
      }
    }
    line.push(hits / (SAMPLES * SAMPLES));
  }
  cover.push(line);
}

const land = cover.map((line) => line.map((value) => value >= COVER));

for (const place of KEEP) {
  const cells = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const lon = WEST + (col + 0.5) * CELL;
      const lat = NORTH - (row + 0.5) * CELL;
      if (lon >= place.west && lon <= place.east && lat <= place.north && lat >= place.south) cells.push({ row, col });
    }
  }
  let count = cells.filter(({ row, col }) => land[row][col]).length;
  const before = count;
  // Admit the best-covered remaining cells first.
  const spare = cells.filter(({ row, col }) => !land[row][col] && cover[row][col] > 0.12);
  spare.sort((a, b) => cover[b.row][b.col] - cover[a.row][a.col]);
  for (const { row, col } of spare) {
    if (count >= place.min) break;
    land[row][col] = true;
    count++;
  }
  console.log(`${place.name}: ${count} cells${count > before ? ` (${count - before} added to keep it visible)` : ""}`);
  if (count < place.min) console.warn(`  warning: still below the ${place.min} cells asked for`);
}

const lines = land.map((line) => line.map((on) => (on ? "#" : ".")).join(""));
const total = lines.join("").replaceAll(".", "").length;

if (process.argv.includes("--preview")) console.log(lines.join("\n"));

const file = `// Generated by scripts/build-land-grid.mjs. Do not edit by hand.
// Land from Natural Earth 1:110m (public domain), sampled onto a lattice for the
// square map in the "Two homes" chapter.
import type { LandGrid } from "./types";

export const landGrid: LandGrid = {
  west: ${WEST},
  east: ${EAST},
  north: ${NORTH},
  south: ${SOUTH},
  cols: ${COLS},
  rows: ${ROWS},
  cells: [
${lines.map((line) => `    "${line}",`).join("\n")}
  ],
};
`;

await writeFile(OUT, file, "utf8");
console.log(`Wrote ${OUT}: ${COLS} x ${ROWS} cells of ${CELL.toFixed(3)} degrees, ${total} land.`);

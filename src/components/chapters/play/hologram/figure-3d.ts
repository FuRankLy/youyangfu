import type { GearSlot } from "@/content/types";

// The Court's player, in cubes: a badminton player standing on a round
// projector floor, racket raised in the right hand, the bag on the floor
// beside the left foot. One unit is one cell; a cell is roughly 4.5 cm, so the
// player stands 39 cells tall. The racket is drawn a little larger than life
// so its string bed reads; the bag is drawn true to its 75 by 31 by 20 cm.
//
// Gear cubes carry the colour they take when the piece turns solid, matched
// to product photos: the Thruster Ryuga's flame red frame with its white
// section and black throat, white BG80, the black GR338, the black and purple
// A970ACE, and the black LZJ bag with its striped logo and orange zip. The
// shirt is part of the player, not gear: it never turns solid.
//
// Coordinates: y up, the player faces +z (the camera at the start), so the
// player's right hand is on the -x side. The turning axis runs through the
// middle of the body at x = 0, z = 0.

export type BodyPart = "shirt" | "skin" | "hair" | "eyes" | "shorts" | "socks";
export type Part = GearSlot | BodyPart;

/** Every part, in id order. Shaders compare these ids. */
export const PARTS: readonly Part[] = ["racket", "strings", "grip", "shirt", "shoes", "bag", "skin", "hair", "eyes", "shorts", "socks"];
export const partId = (part: Part) => PARTS.indexOf(part);

/** Gear the visitor can point at, top to bottom. */
export const GEAR_ORDER: readonly GearSlot[] = ["racket", "strings", "grip", "shoes", "bag"];

/** The parts that turn solid when a piece of gear is shown: the racket brings its strings and grip with it. */
export const SHOWS: Record<GearSlot, readonly Part[]> = {
  racket: ["racket", "strings", "grip"],
  strings: ["strings"],
  grip: ["grip"],
  shoes: ["shoes"],
  bag: ["bag"],
};

export type Voxel = {
  /** Centre, in cells. */
  x: number;
  y: number;
  z: number;
  /** Edge lengths, in cells. */
  sx: number;
  sy: number;
  sz: number;
  /** Turn about the vertical axis, then about the facing axis, in radians. */
  ry: number;
  rz: number;
  part: Part;
  /** The colour it takes when its gear is shown solid (hex). Empty for the player's body. */
  colour: string;
  /** Faces a neighbour covers, so they are never drawn. Bits: +x, -x, +y, -y, +z, -z (in the cube's own axes). */
  hidden: number;
  /** 0 at the bottom of its piece of gear, 1 at the top: the order it materialises in. */
  rise: number;
};

export type Figure = {
  voxels: Voxel[];
  /** Where each piece of gear's leader line starts, in cells. */
  anchors: Record<GearSlot, [number, number, number]>;
  /** The string bed, as an invisible target that is easier to point at than the strings: centre and size. */
  stringBed: { centre: [number, number, number]; size: [number, number, number] };
  /** The turn, in radians, that shows each piece of gear best. */
  facing: Record<GearSlot, number>;
  /** Highest point, in cells. */
  top: number;
  /** Radius of the projector floor, in cells. */
  floorRadius: number;
};

/** Colours sampled from product photos. */
const C = {
  // Victor Thruster Ryuga
  flame: "#e5391b",
  flameLight: "#f2552b",
  frameWhite: "#eceeea",
  graffiti: "#1e2024",
  graffitiGrey: "#c9ccd0",
  shaft: "#2b2d32",
  cone: "#e9eae6",
  // Yonex BG80, white
  string: "#f4f5f1",
  // Victor GR338, black
  grip: "#1b1b1e",
  gripRidge: "#2c2c31",
  buttCap: "#34353a",
  // Victor A970ACE, black and purple
  upper: "#1c1c20",
  sole: "#121215",
  purple: "#5a33c6",
  purpleLight: "#7350dc",
  lace: "#2a9fd6",
  // Victor BR9611LZJ C, black
  bag: "#161618",
  bagEnd: "#222226",
  piping: "#9a9ea3",
  zip: "#f47a1f",
  logoOrange: "#f47a1f",
  logoYellow: "#f5c11d",
  logoGrey: "#a9adb2",
  logoWhite: "#f1f1ee",
  gold: "#8c6a26",
  handle: "#141416",
} as const;

/** The turning axis, in the cell coordinates the body is drawn in below. */
const AXIS_X = -0.5;
const AXIS_Z = -0.5;

/** Racket head: an oval centred on the grip's line, in the right hand. */
const RACKET_X = -9.5;
const RACKET_Z = 1;
const HEAD_Y = 50.5;
const HEAD_A = 4.6;
const HEAD_B = 6.2;
/** The frame's width across the hoop, and its depth. */
const FRAME_W = 0.62;
const FRAME_D = 0.55;
/** Gap between neighbouring strings. */
const STRING_GAP = 0.8;

/** The bag: where its middle stands, how far it is turned (its front looks out to the front right), and its size in cells. */
const BAG = { x: 10.8, z: 2.5, turn: Math.PI / 6, length: 14, height: 6, depth: 4 };

export const FLOOR_RADIUS = 17;

/**
 * The Ryuga's frame colour at a point on the hoop, by angle round the head as
 * seen from the front (0° at three o'clock, 90° at the tip): flame red with a
 * lighter crown, a white section down the left, black graffiti either side of
 * it and at the throat, a grey flash on the right.
 */
function frameColour(degrees: number) {
  const a = (degrees + 360) % 360;
  if (a >= 158 && a <= 212) return C.frameWhite;
  if ((a >= 145 && a < 158) || (a > 212 && a <= 224)) return C.graffiti;
  if (a >= 246 && a <= 294) return C.graffiti;
  if (a >= 14 && a <= 28) return C.graffitiGrey;
  if (a >= 62 && a <= 118) return C.flameLight;
  return C.flame;
}

const NEIGHBOURS = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
] as const;

type Cell = { x: number; y: number; z: number; part: Part; colour: string };

/** A block of whole cells: fill it, then read it out with the faces neighbours hide. */
function grid() {
  const cells = new Map<string, Cell>();
  const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
  const set = (x: number, y: number, z: number, part: Part, colour = "") => cells.set(key(x, y, z), { x, y, z, part, colour });
  const fill = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, part: Part, colour = "") => {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) set(x, y, z, part, colour);
  };
  const read = () => {
    const out: (Cell & { hidden: number })[] = [];
    for (const cell of cells.values()) {
      let hidden = 0;
      NEIGHBOURS.forEach(([dx, dy, dz], bit) => {
        if (cells.has(key(cell.x + dx, cell.y + dy, cell.z + dz))) hidden |= 1 << bit;
      });
      if (hidden !== 63) out.push({ ...cell, hidden }); // a buried cube never shows a face
    }
    return out;
  };
  return { set, fill, read };
}

export function buildFigure(): Figure {
  const body = grid();
  const { set, fill } = body;
  /** Pieces that are not whole cells: the racket, the heel tabs. */
  const pieces: Omit<Voxel, "hidden" | "rise">[] = [];
  const piece = (x: number, y: number, z: number, sx: number, sy: number, sz: number, part: Part, colour = "", rz = 0) =>
    pieces.push({ x, y, z, sx, sy, sz, ry: 0, rz, part, colour });

  // Legs: socks, then skin to the knee and above.
  fill(-4, -2, 2, 3, -1, 1, "socks");
  fill(1, 3, 2, 3, -1, 1, "socks");
  fill(-4, -2, 4, 13, -1, 1, "skin");
  fill(1, 3, 4, 13, -1, 1, "skin");

  // Shoes, the A970ACE in black and purple: black sole and upper, the purple
  // heel unit and heel counter, a purple flash along the outer side, a blue
  // lace accent on the tongue, a purple pull tab.
  for (const [x0, x1, outer] of [
    [-5, -2, -5],
    [1, 4, 4],
  ] as const) {
    fill(x0, x1, 0, 0, -2, 3, "shoes", C.sole);
    fill(x0, x1, 0, 0, -2, -1, "shoes", C.purple);
    fill(x0, x1, 1, 1, -2, 2, "shoes", C.upper);
    fill(x0, x1, 1, 1, -2, -2, "shoes", C.purpleLight);
    fill(outer, outer, 1, 1, -1, 0, "shoes", C.purple);
    fill(x0, x1, 2, 2, -2, -2, "shoes", C.upper);
    fill(x0 + 1, x1 - 1, 2, 2, 1, 1, "shoes", C.upper);
    set(x0 + 1, 2, 1, "shoes", C.lace);
    piece((x0 + x1) / 2, 2.8, -2.35, 0.7, 0.6, 0.3, "shoes", C.purple);
  }

  // Shorts, with a leg opening each side.
  fill(-4, 3, 16, 19, -2, 1, "shorts");
  fill(-5, -1, 14, 15, -2, 1, "shorts");
  fill(0, 4, 14, 15, -2, 1, "shorts");

  // Shirt: torso and shoulders.
  fill(-4, 3, 20, 29, -2, 1, "shirt");
  fill(-5, 4, 28, 30, -2, 1, "shirt");

  // Right arm, raised: sleeve, upper arm out to the side, forearm up, the fist round the grip.
  fill(-7, -6, 25, 29, -2, 0, "shirt");
  fill(-10, -8, 27, 28, -1, 0, "skin");
  fill(-10, -9, 29, 32, -1, 0, "skin");
  fill(-10, -9, 33, 35, 0, 2, "skin");

  // Left arm, hanging: sleeve, arm, hand.
  fill(5, 6, 25, 29, -2, 0, "shirt");
  fill(5, 6, 13, 24, -1, 0, "skin");

  // Neck and head: ears, eyes, hair over the top and back, a fringe.
  fill(-2, 1, 31, 31, -1, 0, "skin");
  fill(-3, 2, 32, 38, -3, 2, "skin");
  fill(-4, -4, 34, 35, -1, -1, "skin");
  fill(3, 3, 34, 35, -1, -1, "skin");
  fill(-3, 2, 37, 38, -3, 2, "hair");
  fill(-3, 2, 32, 36, -3, -3, "hair");
  fill(-3, -3, 34, 36, -3, 0, "hair");
  fill(2, 2, 34, 36, -3, 0, "hair");
  fill(0, 2, 36, 36, 2, 2, "hair");
  set(-2, 35, 2, "eyes");
  set(1, 35, 2, "eyes");

  // Racket, the Thruster Ryuga with a black overgrip: butt cap, the wrapped
  // grip (alternating, for the spiral), white cone, charcoal shaft with red
  // graffiti low down, then the hoop as one unbroken oval of short segments,
  // black at the throat, and a lattice of white strings.
  piece(RACKET_X, 29.6, RACKET_Z, 0.95, 0.8, 0.95, "grip", C.buttCap);
  for (let y = 30; y <= 37; y++) piece(RACKET_X, y + 0.5, RACKET_Z, 0.82, 1, 0.82, "grip", y % 2 === 0 ? C.grip : C.gripRidge);
  piece(RACKET_X, 38.15, RACKET_Z, 0.62, 0.6, 0.62, "racket", C.cone);
  for (let y = 38.5; y < 44.5; y += 1) {
    const colour = y < 39.5 ? C.flame : y < 40.5 ? C.graffiti : y < 41.5 ? C.flame : C.shaft;
    piece(RACKET_X, y + 0.5, RACKET_Z, 0.4, 1, 0.4, "racket", colour);
  }
  const SEGMENTS = 44;
  const onHoop = (t: number) => [RACKET_X + HEAD_A * Math.cos(t), HEAD_Y + HEAD_B * Math.sin(t)] as const;
  for (let i = 0; i < SEGMENTS; i++) {
    const t0 = (i / SEGMENTS) * Math.PI * 2;
    const t1 = ((i + 1) / SEGMENTS) * Math.PI * 2;
    const [x0, y0] = onHoop(t0);
    const [x1, y1] = onHoop(t1);
    const length = Math.hypot(x1 - x0, y1 - y0) + 0.08;
    const tm = (t0 + t1) / 2;
    const [xm, ym] = onHoop(tm);
    piece(xm, ym, RACKET_Z, length, FRAME_W, FRAME_D, "racket", frameColour((tm * 180) / Math.PI), Math.atan2(y1 - y0, x1 - x0));
  }
  // Strings run to the inside edge of the hoop.
  const innerA = HEAD_A - FRAME_W / 2;
  const innerB = HEAD_B - FRAME_W / 2;
  for (let dx = -innerA + STRING_GAP / 2; dx < innerA; dx += STRING_GAP) {
    const half = innerB * Math.sqrt(Math.max(0, 1 - (dx / innerA) ** 2));
    if (half > 0.3) piece(RACKET_X + dx, HEAD_Y, RACKET_Z + 0.04, 0.12, half * 2, 0.12, "strings", C.string);
  }
  for (let dy = -innerB + STRING_GAP / 2; dy < innerB; dy += STRING_GAP) {
    const half = innerA * Math.sqrt(Math.max(0, 1 - (dy / innerB) ** 2));
    if (half > 0.3) piece(RACKET_X, HEAD_Y + dy, RACKET_Z - 0.04, half * 2, 0.12, 0.12, "strings", C.string);
  }

  const voxels: Voxel[] = [
    ...body.read().map((cell) => ({ ...cell, sx: 1, sy: 1, sz: 1, ry: 0, rz: 0, rise: 0 })),
    ...pieces.map((p) => ({ ...p, hidden: 0, rise: 0 })),
  ];
  // Centre the body on its turning axis.
  for (const v of voxels) {
    v.x -= AXIS_X;
    v.z -= AXIS_Z;
  }

  // The bag, the BR9611LZJ, built square in its own cells and then turned so
  // its front looks out to the front right. Front, left to right as you face
  // it: an end panel, plain black above, the striped logo below (the V mark,
  // then the word, warm at the top left fading to white and grey), gold flecks
  // of the LZJ pattern, the other end panel. The orange zip trim and the
  // silver piping are thin strips laid over the surface, as on the bag.
  const FRONT = [
    "E............E",
    "E............E",
    "E..........g.E",
    "EOO.OOYYWW.WWE",
    "E.Y.YWWGGW.GWE",
    "Eg..g..g..g..E",
  ];
  const SWATCH: Record<string, string> = {
    E: C.bagEnd,
    O: C.logoOrange,
    Y: C.logoYellow,
    W: C.logoWhite,
    G: C.logoGrey,
    g: C.gold,
    ".": C.bag,
  };
  const bag = grid();
  const { length: L, height: H, depth: D } = BAG;
  bag.fill(0, L - 1, 0, H - 1, 0, D - 1, "bag", C.bag);
  bag.fill(0, 0, 0, H - 1, 0, D - 1, "bag", C.bagEnd);
  bag.fill(L - 1, L - 1, 0, H - 1, 0, D - 1, "bag", C.bagEnd);
  FRONT.forEach((row, r) => [...row].forEach((code, i) => bag.set(i, H - 1 - r, D - 1, "bag", SWATCH[code])));
  const cos = Math.cos(BAG.turn);
  const sin = Math.sin(BAG.turn);
  /** From the bag's own cells (x along its length, z out of its front) to the figure's. */
  const place = (lx: number, ly: number, lz: number): [number, number, number] => {
    const x = lx - (L - 1) / 2;
    const z = lz - (D - 1) / 2;
    return [BAG.x + x * cos + z * sin, ly, BAG.z - x * sin + z * cos];
  };
  for (const cell of bag.read()) {
    const [x, y, z] = place(cell.x, cell.y, cell.z);
    voxels.push({ ...cell, x, y, z, sx: 1, sy: 1, sz: 1, ry: BAG.turn, rz: 0, rise: 0 });
  }
  const middle = (L - 1) / 2;
  const mid = (D - 1) / 2;
  const front = D - 0.5 + 0.03;
  const strip = (lx: number, ly: number, lz: number, sx: number, sy: number, sz: number, colour: string, slope = 0) => {
    const [x, y, z] = place(lx, ly, lz);
    voxels.push({ x, y, z, sx, sy, sz, ry: BAG.turn, rz: slope, part: "bag", colour, hidden: 0, rise: 0 });
  };
  // The carry handle, with an orange stripe along its grip.
  strip(middle, H + 0.75, mid, 4.2, 0.35, 0.5, C.handle);
  strip(middle, H + 0.96, mid, 2.6, 0.06, 0.52, C.zip);
  strip(middle - 2, H + 0.05, mid, 0.35, 1.1, 0.45, C.handle);
  strip(middle + 2, H + 0.05, mid, 0.35, 1.1, 0.45, C.handle);
  // Silver piping along both top edges.
  strip(middle, H - 0.5, D - 0.5, L - 1.2, 0.14, 0.14, C.piping);
  strip(middle, H - 0.5, -0.5, L - 1.2, 0.14, 0.14, C.piping);
  // The orange zip trim, sweeping from the top right down to the left.
  const ZIP: [number, number][] = [
    [12.9, 4.55],
    [9.2, 4.5],
    [6.6, 3.95],
    [3.2, 3.55],
    [0.4, 3.45],
  ];
  for (let i = 0; i < ZIP.length - 1; i++) {
    const [x0, y0] = ZIP[i];
    const [x1, y1] = ZIP[i + 1];
    strip((x0 + x1) / 2, (y0 + y1) / 2, front, Math.hypot(x1 - x0, y1 - y0) + 0.06, 0.17, 0.06, C.zip, Math.atan2(y1 - y0, x1 - x0));
  }

  // Rise: each piece of gear materialises from its lowest cube to its highest;
  // the racket, strings and grip count as one piece.
  const group = (part: Part) => (part === "strings" || part === "grip" ? "racket" : part);
  const span = new Map<string, [number, number]>();
  for (const v of voxels) {
    const [lo, hi] = span.get(group(v.part)) ?? [Infinity, -Infinity];
    span.set(group(v.part), [Math.min(lo, v.y), Math.max(hi, v.y)]);
  }
  for (const v of voxels) {
    const [lo, hi] = span.get(group(v.part))!;
    v.rise = hi > lo ? (v.y - lo) / (hi - lo) : 0;
  }

  const at = (x: number, y: number, z: number): [number, number, number] => [x - AXIS_X, y, z - AXIS_Z];
  return {
    voxels,
    anchors: {
      racket: at(RACKET_X, HEAD_Y + HEAD_B, RACKET_Z),
      strings: at(RACKET_X - 1, HEAD_Y + 1, RACKET_Z),
      grip: at(RACKET_X, 31, RACKET_Z + 0.5),
      shoes: at(-3.5, 1, 3.5),
      bag: place(middle, H - 0.5, D - 1),
    },
    stringBed: { centre: at(RACKET_X, HEAD_Y, RACKET_Z), size: [HEAD_A * 2 - 1.4, HEAD_B * 2 - 1.4, 0.4] },
    facing: { racket: 0.15, strings: 0, grip: 0.3, shoes: 0.5, bag: -BAG.turn },
    top: HEAD_Y + HEAD_B + 0.5,
    floorRadius: FLOOR_RADIUS,
  };
}

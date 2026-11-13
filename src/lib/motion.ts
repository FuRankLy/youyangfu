// Motion tokens. The only easing curves and durations the site uses.
// See docs/blueprint.md, section 6.

/** CSS strings, for style props and Motion transitions. The same curves exist as Tailwind `ease-*` utilities. */
export const EASE_CSS = {
  brush: "cubic-bezier(.55, 0, .35, 1)",
  flight: "cubic-bezier(.7, 0, .2, 1)",
  settle: "cubic-bezier(.2, .8, .2, 1)",
  out: "cubic-bezier(.16, 1, .3, 1)",
} as const;

/** Bezier control points, for Motion's `ease: [x1, y1, x2, y2]`. */
export const EASE_POINTS = {
  brush: [0.55, 0, 0.35, 1],
  flight: [0.7, 0, 0.2, 1],
  settle: [0.2, 0.8, 0.2, 1],
  out: [0.16, 1, 0.3, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

/** Milliseconds. */
export const DURATION = {
  micro: 160,
  ui: 320,
  reveal: 600,
  flight: 720,
} as const;

export const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** A CSS-style cubic-bezier easing as a function of progress 0..1. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    let t = x;
    for (let i = 0; i < 18; i++) {
      if (sampleX(t) < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return sampleY(t);
  };
}

/** The motion tokens as functions, for canvas work. */
export const ease = {
  brush: cubicBezier(0.55, 0, 0.35, 1),
  flight: cubicBezier(0.7, 0, 0.2, 1),
  settle: cubicBezier(0.2, 0.8, 0.2, 1),
  out: cubicBezier(0.16, 1, 0.3, 1),
};

/** Overshoot, for squares popping onto the lattice. */
export const backOut = (x: number, s = 2.2) => {
  const v = x - 1;
  return v * v * ((s + 1) * v + s) + 1;
};

/** Finds x where a monotonic easing reaches y. */
export function invert(fn: (x: number) => number, y: number) {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (fn(mid) < y) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Small seeded generator, so layouts are identical on every resize and visit. */
export function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

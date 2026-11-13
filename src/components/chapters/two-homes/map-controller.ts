// Runs the square map in the page: sizes the canvas, keeps the HTML labels on
// their marks, follows the pointer, and plays the flip. No React in here. The
// component hands over two elements and gets back a small handle.
//
// Labels are ordinary elements inside the box, found by their `data-label`
// attribute. This module only moves them (transform) and fades them (opacity).
import { clamp, lerp, prefersReducedMotion, smoothstep } from "@/lib/motion";
import { COLS, EQUATOR, ROWS, curvePoint, flipAt, marks, type Point } from "./geo";
import { drawMap, restingScene, type MapColors, type MapLayout, type MapScene } from "./map-renderer";

/** How long the flip takes, start to finish. */
const FLIP_MS = 600;
/** Land sits between the lattice colour and secondary text: 0 is --grid, 1 is --ink-soft. */
const LAND_TONE = 0.34;

type LabelSpec = {
  /** Where the label hangs: a point on the lattice, or a row at the right edge of the frame. */
  anchor: Point | { edge: "right"; y: number };
  /** Which point of the label's box sits on the anchor: 0 is its left or top, 1 its right or bottom. */
  align: [number, number];
  /** Shift from the anchor, in cells. */
  shift: [number, number];
  /** A further shift in pixels. */
  nudge?: [number, number];
  /** True if the label travels with the map when it flips; it also clears the land beneath it. */
  follows: boolean;
  /** Fades with this scene value instead of always showing. */
  fade?: "parallel";
};

const LABELS = {
  // Above and to the left, clear of the rail strokes.
  hometown: { anchor: marks.hometown.at, align: [1, 1], shift: [-1, -3.1], follows: true },
  // Out over the Pacific, on the far side of the incoming flight.
  home: { anchor: marks.home.at, align: [0, 1], shift: [1.2, -0.9], follows: true },
  // In the open water on the outside of the curve.
  flight: { anchor: curvePoint(marks.flight, 0.42), align: [0, 1], shift: [1.2, -0.6], follows: true },
  equator: { anchor: { edge: "right", y: EQUATOR }, align: [1, 1], shift: [0, 0], nudge: [-2, -4], follows: false },
  parallel: {
    anchor: { edge: "right", y: marks.homeParallel },
    align: [1, 1],
    shift: [0, 0],
    nudge: [-2, -4],
    follows: false,
    fade: "parallel",
  },
} satisfies Record<string, LabelSpec>;

type LabelId = keyof typeof LABELS;
const LABEL_IDS = Object.keys(LABELS) as LabelId[];

type Rest = { left: number; top: number; width: number; height: number };

export type HomesMap = {
  /** Mirrors the map across the equator, or puts it back. Instant with reduced motion. */
  setFlipped(on: boolean): void;
  /** Sets scene values directly and redraws. For scrubbing from a scroll scene. */
  set(scene: Partial<MapScene>): void;
  destroy(): void;
};

export function createHomesMap(box: HTMLElement, canvas: HTMLCanvasElement): HomesMap {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { setFlipped() {}, set() {}, destroy() {} };

  const labels = new Map<LabelId, HTMLElement>();
  for (const id of LABEL_IDS) {
    const el = box.querySelector<HTMLElement>(`[data-label="${id}"]`);
    if (el) labels.set(id, el);
  }

  const scene: MapScene = { ...restingScene };
  const pointer = { x: 0, y: 0, strength: 0, active: false };
  const hidden = new Uint8Array(COLS * ROWS);
  const rests = new Map<LabelId, Rest>();
  let layout: MapLayout | null = null;
  let colors = readColors();
  let flipTarget = 0;
  /** Exact size of the canvas in device pixels, where the browser reports it. */
  let deviceSize: { width: number; height: number } | null = null;
  let raf = 0;
  let last = 0;

  // --- Layout ---

  function measure() {
    const bounds = box.getBoundingClientRect();
    const { width, height } = bounds;
    if (width < 1 || height < 1) return;
    const dpr = window.devicePixelRatio || 1;

    // The cell is a whole number of device pixels. The frame is anchored top
    // left; whatever is left over at the right and bottom is open sea anyway.
    // On narrow screens the lattice also leaves room for Auckland's label.
    const homeLabel = labels.get("home");
    const homeSpec = LABELS.home;
    const room = homeLabel ? (width - homeLabel.offsetWidth - 4) / (homeSpec.anchor.x + homeSpec.shift[0]) : Infinity;
    const unit = Math.max(2, Math.floor(Math.min(width / COLS, height / ROWS, room) * dpr));
    const cell = unit / dpr;
    layout = { cell, dpr };

    // The device-pixel size only corrects rounding. Some browsers (Chrome under
    // device emulation, for one) report CSS pixels there instead, which would
    // draw the map several times too large; ignore a size that is that far off.
    const exact =
      deviceSize && Math.abs(deviceSize.width - width * dpr) < 2 && Math.abs(deviceSize.height - height * dpr) < 2
        ? deviceSize
        : null;
    const bitmapWidth = exact?.width ?? Math.round(width * dpr);
    const bitmapHeight = exact?.height ?? Math.round(height * dpr);
    if (canvas.width !== bitmapWidth || canvas.height !== bitmapHeight) {
      canvas.width = bitmapWidth;
      canvas.height = bitmapHeight;
    }

    const snap = (value: number) => Math.round(value * dpr) / dpr;
    const mapHeight = ROWS * cell;
    rests.clear();
    for (const [id, el] of labels) {
      const spec: LabelSpec = LABELS[id];
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const anchorX = "edge" in spec.anchor ? width : spec.anchor.x * cell;
      const left = anchorX + spec.shift[0] * cell + (spec.nudge?.[0] ?? 0) - spec.align[0] * w;
      const top = spec.anchor.y * cell + spec.shift[1] * cell + (spec.nudge?.[1] ?? 0) - spec.align[1] * h;
      rests.set(id, {
        left: snap(clamp(left, 0, Math.max(0, width - w))),
        top: snap(clamp(top, 0, Math.max(0, mapHeight - h))),
        width: w,
        height: h,
      });
    }

    // Clear the land under each travelling label, so text sits on paper. Label
    // boxes mirror exactly when the map flips, so one set serves both states.
    hidden.fill(0);
    const pad = cell * 0.45 + 2;
    for (const [id, rest] of rests) {
      if (!LABELS[id].follows) continue;
      const firstCol = Math.max(0, Math.floor((rest.left - pad) / cell));
      const lastCol = Math.min(COLS - 1, Math.floor((rest.left + rest.width + pad) / cell));
      const firstRow = Math.max(0, Math.floor((rest.top - pad) / cell));
      const lastRow = Math.min(ROWS - 1, Math.floor((rest.top + rest.height + pad) / cell));
      for (let row = firstRow; row <= lastRow; row++) {
        const y = (row + 0.5) * cell;
        if (y < rest.top - pad || y > rest.top + rest.height + pad) continue;
        for (let col = firstCol; col <= lastCol; col++) {
          const x = (col + 0.5) * cell;
          if (x >= rest.left - pad && x <= rest.left + rest.width + pad) hidden[row * COLS + col] = 1;
        }
      }
    }

    place();
    draw();
    box.dataset.ready = "true";
  }

  /** Puts every label where the current scene says it belongs. */
  function place() {
    if (!layout) return;
    const { cell, dpr } = layout;
    const mapHeight = ROWS * cell;
    for (const [id, el] of labels) {
      const rest = rests.get(id);
      if (!rest) continue;
      const spec: LabelSpec = LABELS[id];
      let top = rest.top;
      if (spec.follows && !("edge" in spec.anchor)) {
        top = lerp(rest.top, mapHeight - rest.top - rest.height, flipAt(scene.flip, spec.anchor.x));
      }
      el.style.transform = `translate(${rest.left}px, ${Math.round(top * dpr) / dpr}px)`;
      if (spec.fade) {
        const shown = scene[spec.fade];
        el.style.opacity = String(shown);
        el.style.visibility = shown > 0.001 ? "visible" : "hidden";
      }
    }
  }

  function draw() {
    if (!layout || !ctx) return;
    drawMap(ctx, layout, colors, scene, pointer.strength > 0.001 ? pointer : null, hidden);
  }

  // --- Animation: runs only while something is moving ---

  function frame(now: number) {
    raf = 0;
    const dt = last ? Math.min(64, now - last) : 16;
    last = now;
    let busy = false;

    if (scene.flip !== flipTarget) {
      const step = dt / FLIP_MS;
      scene.flip = flipTarget > scene.flip ? Math.min(flipTarget, scene.flip + step) : Math.max(flipTarget, scene.flip - step);
      scene.parallel = smoothstep(0.55, 1, scene.flip);
      place();
      busy = scene.flip !== flipTarget;
    }

    const goal = pointer.active ? 1 : 0;
    if (pointer.strength !== goal) {
      pointer.strength += (goal - pointer.strength) * Math.min(1, dt / 140);
      if (Math.abs(goal - pointer.strength) < 0.004) pointer.strength = goal;
      busy = busy || pointer.strength !== goal;
    }

    draw();
    if (busy) request();
    else last = 0;
  }

  function request() {
    if (!raf) raf = requestAnimationFrame(frame);
  }

  // --- Events ---

  function onPointerMove(event: PointerEvent) {
    // Squares answer a mouse only: touch has no hover, and reduced motion gets a still map.
    if (event.pointerType !== "mouse" || prefersReducedMotion()) return;
    const bounds = canvas.getBoundingClientRect();
    pointer.x = event.clientX - bounds.left;
    pointer.y = event.clientY - bounds.top;
    pointer.active = true;
    request();
  }

  function onPointerGone() {
    if (!pointer.active) return;
    pointer.active = false;
    request();
  }

  function onModeChange() {
    colors = readColors();
    draw();
  }

  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      if (entry.target !== canvas) continue;
      const size = entry.devicePixelContentBoxSize?.[0];
      deviceSize = size ? { width: size.inlineSize, height: size.blockSize } : null;
    }
    measure();
  });
  try {
    observer.observe(canvas, { box: "device-pixel-content-box" });
  } catch {
    observer.observe(canvas); // Safari: no device-pixel box, fall back to rounding
  }
  // Labels change size when the font arrives or their text changes.
  for (const el of labels.values()) observer.observe(el);

  box.addEventListener("pointermove", onPointerMove);
  box.addEventListener("pointerleave", onPointerGone);
  window.addEventListener("blur", onPointerGone);
  window.addEventListener("modechange", onModeChange);

  return {
    setFlipped(on) {
      flipTarget = on ? 1 : 0;
      if (prefersReducedMotion()) {
        scene.flip = flipTarget;
        scene.parallel = flipTarget;
        place();
        draw();
      } else {
        request();
      }
    },
    set(next) {
      Object.assign(scene, next);
      flipTarget = scene.flip;
      place();
      draw();
    },
    destroy() {
      observer.disconnect();
      box.removeEventListener("pointermove", onPointerMove);
      box.removeEventListener("pointerleave", onPointerGone);
      window.removeEventListener("blur", onPointerGone);
      window.removeEventListener("modechange", onModeChange);
      if (raf) cancelAnimationFrame(raf);
    },
  };
}

// --- Colour ---
// Read from the CSS variables each time the mode changes; in Now mode they
// drift through the day.

function readColors(): MapColors {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string) => style.getPropertyValue(name).trim();
  const soft = read("--ink-soft");
  return {
    land: mix(read("--grid"), soft, LAND_TONE),
    ink: read("--ink"),
    accent: read("--cinnabar"),
    rule: soft,
  };
}

function parseColor(value: string): [number, number, number] | null {
  if (value.startsWith("#")) {
    let hex = value.slice(1);
    if (hex.length === 3) hex = Array.from(hex, (c) => c + c).join("");
    const n = parseInt(hex.slice(0, 6), 16);
    return Number.isNaN(n) ? null : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const parts = value.match(/[\d.]+/g);
  return parts && parts.length >= 3 ? [Number(parts[0]), Number(parts[1]), Number(parts[2])] : null;
}

function mix(a: string, b: string, t: number) {
  const x = parseColor(a);
  const y = parseColor(b);
  if (!x || !y) return a;
  return `rgb(${x.map((v, i) => Math.round(lerp(v, y[i], t))).join(", ")})`;
}

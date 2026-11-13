// The squares engine for written characters.
//
// It writes Chinese characters in true stroke order as squares on a lattice,
// then (optionally) lets the squares fly into a Latin word and stamps the name
// seal beside it. The home page opening uses the full sequence; the 404 page
// uses the writing alone.
//
// Ported from docs/prototypes/opening-sequence.html. It knows nothing about
// React: give it a canvas and options, and call destroy() when done.
import { GLYPH_BASELINE, GLYPH_BOX, SEAL_GRID, glyph } from "@/lib/hanzi";
import { backOut, clamp, ease, invert, lerp, rng } from "@/lib/motion";

export type Syllable = {
  /** Pinyin with its tone mark, e.g. "fù". */
  text: string;
  /** Tone contour on the Chao 1 to 5 scale: [start, end]. */
  chao: readonly [number, number];
};

export type Rect = { x: number; y: number; w: number; h: number };

export type SceneLayout = {
  /** Area covering the name in both scripts, in canvas CSS pixels. */
  name: Rect;
  /** Where the seal currently sits. Null when the scene has no seal. */
  seal: Rect | null;
  /** Y position just under the resting name, for text placed beneath it. */
  textTop: number;
  /** 1 while the characters show, 0 while the Latin word shows. */
  han: number;
};

export type GlyphSceneOptions = {
  chars: readonly string[];
  pinyin?: readonly Syllable[];
  /** Word the squares fly into after the writing. Leave out to stay as characters. */
  latin?: string;
  /** Stamp the name seal beside the Latin word. */
  seal?: boolean;
  /** CSS font-family used for the Latin word and the pinyin. */
  fontFamily: string;
  /** Where the name's centre sits, as a fraction of the canvas height. */
  centerY?: number;
  /** Largest character box, in CSS pixels. */
  maxSize?: number;
  /** Largest character box as a share of the canvas height. */
  heightShare?: number;
  /** Skip the writing: start with the characters already on the page. */
  short?: boolean;
  /** Reduced motion: show the final state, switch scripts instantly. */
  reduced?: boolean;
  onLayout?(layout: SceneLayout): void;
  /** Called once, when the sequence has finished and the scene is at rest. */
  onIdle?(): void;
};

type Shape = "han" | "lat";

type Colors = { paper: string; ink: string; inkSoft: string; grid: string; cinnabar: string };

type PreparedGlyph = {
  paths: Path2D[];
  medians: { pts: number[][]; cum: number[]; len: number }[];
};

type Layout = {
  S: number;
  gap: number;
  c: number;
  hanW: number;
  Z: number;
  left: number;
  hanTop: number;
  midY: number;
  F: number;
  font: string;
  latLeft: number;
  latW: number;
  latBL: number;
  cap: number;
  baseline: number;
  sealHan: { x: number; y: number };
  sealLat: { x: number; y: number };
  hanRect: Rect;
  latRect: Rect;
};

// Timing, in milliseconds at normal speed.
const T_WRITE = 560;
const STROKE_GAP = 55;
const CHAR_GAP = 210;
const HOLD = 1150; // characters rest this long before the flight
const D_FLIGHT = 720;
const SPREAD = 0.3; // stagger across the name, as a share of D_FLIGHT
const D_MORPH = D_FLIGHT * (1 + SPREAD + 0.12);
const D_STAMP = 460;
const SCALE_IN = 300; // a square popping onto the lattice
const WET = 520; // how long a fresh square stays cinnabar
const WET_STEPS = 8;
const SKIP_SPEED = 7;

const rgbOf = (color: string): [number, number, number] => {
  const c = color.trim();
  if (c.startsWith("rgb")) {
    const m = c.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
    return [m[0], m[1], m[2]];
  }
  let h = c.replace("#", "");
  if (h.length === 3) h = h.split("").map((x) => x + x).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a: string, b: string, t: number) => {
  const x = rgbOf(a);
  const y = rgbOf(b);
  return `rgb(${Math.round(lerp(x[0], y[0], t))},${Math.round(lerp(x[1], y[1], t))},${Math.round(lerp(x[2], y[2], t))})`;
};

export class GlyphScene {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private probe: CanvasRenderingContext2D;
  private opts: GlyphSceneOptions;
  private glyphs: PreparedGlyph[];
  private schedule: { start: number; dur: number }[][] = [];
  private tl = { writeEnd: 0, pinyin: 0, morph: Infinity, stamp: Infinity, idle: 0 };

  private W = 0;
  private H = 0;
  private dpr = 1;
  private G!: Layout;
  private P = 0;
  private A!: Record<
    "hx" | "hy" | "lx" | "ly" | "rev" | "fx" | "fy" | "fs" | "fa" | "ta" | "cx" | "cy" | "cs" | "ca" | "kx" | "ky" | "bump" | "delay" | "dir" | "r",
    Float32Array
  > & { dupH: Uint8Array; dupL: Uint8Array };

  private T = 0;
  private speed = 1;
  private last = 0;
  private raf = 0;
  private running = false;
  private visible = true;
  private destroyed = false;

  private shape: Shape = "han";
  private target: Shape = "han";
  private morph: { start: number; to: Shape } | null = null;
  private introMorphDone = false;
  private hNow = 1;
  private hFrom = 1;
  private shock: { t: number; x: number; y: number } | null = null;
  private shocked = false;
  private idleFired = false;
  private pointer = { x: -1e4, y: -1e4, active: false, s: 0 };

  private colors: Colors = { paper: "#edefec", ink: "#1b1e24", inkSoft: "#5c636d", grid: "#c3c8c8", cinnabar: "#c23b22" };
  private wet: string[] = [];
  private sealCanvas: HTMLCanvasElement | null = null;

  constructor(canvas: HTMLCanvasElement, options: GlyphSceneOptions) {
    this.canvas = canvas;
    this.opts = options;
    const ctx = canvas.getContext("2d");
    const probe = document.createElement("canvas").getContext("2d");
    if (!ctx || !probe) throw new Error("Canvas 2D is not available");
    this.ctx = ctx;
    this.probe = probe;

    this.glyphs = options.chars.map((char) => {
      const g = glyph(char);
      return {
        paths: g.strokes.map((d) => new Path2D(d)),
        medians: g.medians.map((pts) => {
          const cum = [0];
          for (let i = 1; i < pts.length; i++) {
            cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
          }
          return { pts, cum, len: cum[cum.length - 1] || 1 };
        }),
      };
    });

    // Stroke schedule. The hand loosens up as it writes: each character is a little quicker.
    let cursor = T_WRITE;
    this.glyphs.forEach((g, ci) => {
      const pace = Math.max(0.86, 1.12 - ci * 0.1);
      this.schedule.push(
        g.medians.map((m, si) => {
          const dur = (80 + m.len * 0.24) * pace;
          const slot = { start: cursor, dur };
          cursor += dur + (si < g.medians.length - 1 ? STROKE_GAP : 0);
          return slot;
        }),
      );
      if (ci < this.glyphs.length - 1) cursor += CHAR_GAP;
    });
    this.tl.writeEnd = cursor;
    this.tl.pinyin = cursor + 140;
    if (options.latin) {
      this.tl.morph = cursor + HOLD;
      this.tl.stamp = options.seal ? this.tl.morph + D_MORPH + 120 : Infinity;
      this.tl.idle = options.seal ? this.tl.stamp + D_STAMP + 80 : this.tl.morph + D_MORPH + 80;
    } else {
      this.tl.idle = this.tl.pinyin + 900;
    }

    this.refreshColors(false);
    this.resize();
    this.replay();
  }

  /* ---------- public API ---------- */

  /** Restarts the sequence from the top (or from its shortened start). */
  replay() {
    const { reduced, short, latin } = this.opts;
    this.morph = null;
    this.shock = null;
    this.speed = 1;
    this.idleFired = false;
    if (reduced) {
      this.T = this.tl.idle + 1;
      this.introMorphDone = true;
      this.shocked = true;
      this.shape = this.target = latin ? "lat" : "han";
    } else {
      this.T = short ? (latin ? this.tl.morph - 420 : this.tl.pinyin + 500) : 0;
      this.introMorphDone = false;
      this.shocked = false;
      this.shape = this.target = "han";
    }
    this.hNow = this.shape === "han" ? 1 : 0;
    if (this.A) this.restAt(this.shape);
    this.emitLayout();
    this.wake();
  }

  /** Plays the rest of the sequence quickly, e.g. when the visitor starts scrolling. */
  skip() {
    if (this.T < this.tl.idle) this.speed = SKIP_SPEED;
  }

  get idle() {
    return this.T >= this.tl.idle;
  }

  /** Shows the name in one script. Ignored until the sequence is at rest. */
  show(shape: Shape) {
    if (!this.idle || !this.opts.latin) return;
    this.startMorph(shape);
    this.wake();
  }

  toggle() {
    this.show(this.target === "han" ? "lat" : "han");
  }

  get showing(): Shape {
    return this.target;
  }

  /** Pointer position in canvas CSS pixels. Squares nearby grow slightly. */
  setPointer(x: number, y: number, active: boolean) {
    this.pointer.x = x;
    this.pointer.y = y;
    this.pointer.active = active && !this.opts.reduced;
    this.wake();
  }

  /** Pause drawing while the canvas is off screen. */
  setVisible(visible: boolean) {
    this.visible = visible;
    if (visible) this.wake();
  }

  /** Re-read colours from the CSS variables (they change with the colour mode). */
  refreshColors(redraw = true) {
    const cs = getComputedStyle(document.documentElement);
    const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
    this.colors = {
      paper: v("--paper", "#edefec"),
      ink: v("--ink", "#1b1e24"),
      inkSoft: v("--ink-soft", "#5c636d"),
      grid: v("--grid", "#c3c8c8"),
      cinnabar: v("--cinnabar", "#c23b22"),
    };
    this.wet = [];
    for (let b = 0; b < WET_STEPS; b++) this.wet.push(mix(this.colors.cinnabar, this.colors.ink, b / (WET_STEPS - 1)));
    if (this.G && this.opts.seal) this.sealCanvas = this.makeSeal(this.G.Z);
    if (redraw) this.wake();
  }

  /** Call when the canvas element changes size. */
  resize() {
    const box = this.canvas.getBoundingClientRect();
    if (box.width < 2 || box.height < 2) return;
    this.W = box.width;
    this.H = box.height;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
    this.computeLayout();
    if (this.morph) {
      this.shape = this.morph.to;
      this.morph = null;
    }
    this.target = this.shape;
    this.hNow = this.shape === "han" ? 1 : 0;
    this.shocked = this.T >= this.tl.stamp;
    this.buildParticles();
    if (this.opts.seal) this.sealCanvas = this.makeSeal(this.G.Z);
    this.emitLayout();
    this.wake();
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.running = false;
  }

  /* ---------- layout and cells ---------- */

  private computeLayout() {
    const { W, H, dpr, probe } = this;
    const n = this.glyphs.length;
    const { latin, fontFamily, maxSize = 248, centerY = 0.47, heightShare = 0.3, seal } = this.opts;
    const gutter = Math.max(24, W * 0.07);
    const sealShare = seal ? 0.4 : 0;
    const S = Math.max(56, Math.min(maxSize, H * heightShare, (W - 2 * gutter) / (n + 0.14 * (n - 1) + sealShare)));
    const gap = S * 0.14;
    const c = Math.max(2.5, Math.round((S / 50) * dpr) / dpr);
    const hanW = n * S + (n - 1) * gap;
    const Z = seal ? S * 0.27 : 0;
    const sealGap = seal ? S * 0.13 : 0;
    const left = (W - (hanW + sealGap + Z)) / 2;
    const hanTop = H * centerY - S / 2 - S * 0.1;
    const midY = hanTop + S / 2;

    let F = 0;
    let font = "";
    let latBL = 0;
    let latW = hanW;
    let cap = S * 0.5;
    if (latin) {
      probe.font = `600 100px ${fontFamily}`;
      if ("letterSpacing" in probe) probe.letterSpacing = "-2px";
      let m = probe.measureText(latin);
      const w100 = (m.actualBoundingBoxLeft || 0) + (m.actualBoundingBoxRight || m.width);
      F = Math.min((100 * hanW * 0.98) / w100, S * 1.02);
      font = `600 ${F}px ${fontFamily}`;
      probe.font = font;
      if ("letterSpacing" in probe) probe.letterSpacing = `${-0.02 * F}px`;
      m = probe.measureText(latin);
      latBL = m.actualBoundingBoxLeft || 0;
      latW = latBL + (m.actualBoundingBoxRight || m.width);
      cap = probe.measureText("F").actualBoundingBoxAscent || F * 0.7;
    }
    const latLeft = left + (hanW - latW) / 2;
    const baseline = midY + cap / 2;

    this.G = {
      S, gap, c, hanW, Z, left, hanTop, midY, F, font, latLeft, latW, latBL, cap, baseline,
      sealHan: { x: left + hanW + sealGap, y: hanTop + S - Z },
      sealLat: { x: latLeft + latW + sealGap, y: baseline - Z },
      hanRect: { x: left, y: hanTop, w: hanW, h: S },
      latRect: { x: latLeft, y: baseline - cap, w: latW, h: cap },
    };
  }

  private buildHanCells() {
    const { S, gap, c, left, hanTop } = this.G;
    const scale = GLYPH_BOX / S;
    const cells: { x: number; y: number; t: number }[] = [];
    const rand = rng(1984);
    this.glyphs.forEach((g, ci) => {
      const bx = left + ci * (S + gap);
      const by = hanTop;
      const i0 = Math.ceil(bx / c - 0.5);
      const i1 = Math.floor((bx + S) / c - 0.5);
      const j0 = Math.ceil(by / c - 0.5);
      const j1 = Math.floor((by + S) / c - 0.5);
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const x = (i + 0.5) * c;
          const y = (j + 0.5) * c;
          const dx = (x - bx) * scale;
          const dy = GLYPH_BASELINE - (y - by) * scale;
          for (let si = 0; si < g.paths.length; si++) {
            if (!this.probe.isPointInPath(g.paths[si], dx, dy)) continue;
            // When the brush reaches this square: its place along the stroke's centre line.
            const { u, d } = projectOnto(g.medians[si], dx, dy);
            const slot = this.schedule[ci][si];
            cells.push({ x, y, t: slot.start + invert(ease.brush, u) * slot.dur + d * 0.2 + rand() * 12 });
            break;
          }
        }
      }
    });
    return cells;
  }

  private buildLatinCells() {
    const { latin } = this.opts;
    if (!latin) return [];
    const { c, latLeft, latBL, baseline, cap, latW, font, F } = this.G;
    const x0 = Math.floor(latLeft - c * 3);
    const y0 = Math.floor(baseline - cap - c * 4);
    const w = Math.ceil(latW + c * 6);
    const h = Math.ceil(cap + c * 8);
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const o = off.getContext("2d", { willReadFrequently: true });
    if (!o) return [];
    o.font = font;
    if ("letterSpacing" in o) o.letterSpacing = `${-0.02 * F}px`;
    o.fillStyle = "#000";
    o.textBaseline = "alphabetic";
    o.fillText(latin, latLeft + latBL - x0, baseline - y0);
    const data = o.getImageData(0, 0, w, h).data;
    const inked = (x: number, y: number) => {
      const px = Math.round(x - x0);
      const py = Math.round(y - y0);
      if (px < 0 || py < 0 || px >= w || py >= h) return 0;
      return data[(py * w + px) * 4 + 3] > 127 ? 1 : 0;
    };
    const cells: { x: number; y: number }[] = [];
    const q = c * 0.25;
    for (let j = Math.ceil(y0 / c - 0.5); j <= Math.floor((y0 + h) / c - 0.5); j++) {
      for (let i = Math.ceil(x0 / c - 0.5); i <= Math.floor((x0 + w) / c - 0.5); i++) {
        const x = (i + 0.5) * c;
        const y = (j + 0.5) * c;
        if (inked(x - q, y - q) + inked(x + q, y - q) + inked(x - q, y + q) + inked(x + q, y + q) >= 2) cells.push({ x, y });
      }
    }
    return cells;
  }

  private buildParticles() {
    const han = this.buildHanCells();
    const lat = this.buildLatinCells();
    const byX = (cells: { x: number; y: number }[]) =>
      cells.map((_, i) => i).sort((a, b) => cells[a].x - cells[b].x || cells[a].y - cells[b].y);
    const hs = byX(han);
    const ls = byX(lat);
    const P = (this.P = Math.max(han.length, lat.length, 1));
    const f = () => new Float32Array(P);
    this.A = {
      hx: f(), hy: f(), lx: f(), ly: f(), rev: f(),
      fx: f(), fy: f(), fs: f(), fa: f(), ta: f(),
      cx: f(), cy: f(), cs: f(), ca: f(),
      kx: f(), ky: f(), bump: f(), delay: f(), dir: f(), r: f(),
      dupH: new Uint8Array(P), dupL: new Uint8Array(P),
    };
    const A = this.A;
    const rand = rng(2016);
    let prevH = -1;
    let prevL = -1;
    for (let j = 0; j < P; j++) {
      // Squares keep their left-to-right order between the two words, so the flight reads as one sweep.
      const hi = han.length ? Math.floor((j * han.length) / P) : -1;
      const li = lat.length ? Math.floor((j * lat.length) / P) : -1;
      if (hi >= 0) {
        const cell = han[hs[hi]];
        A.hx[j] = cell.x;
        A.hy[j] = cell.y;
        A.rev[j] = cell.t;
      }
      if (li >= 0) {
        const cell = lat[ls[li]];
        A.lx[j] = cell.x;
        A.ly[j] = cell.y;
      } else {
        A.lx[j] = A.hx[j];
        A.ly[j] = A.hy[j];
      }
      A.dupH[j] = hi === prevH ? 1 : 0;
      A.dupL[j] = li === prevL ? 1 : 0;
      prevH = hi;
      prevL = li;
      A.dir[j] = rand() < 0.5 ? -1 : 1;
      A.r[j] = rand();
      A.bump[j] = 0.22 + 0.5 * rand();
    }
    this.restAt(this.shape);
  }

  private restAt(shape: Shape) {
    const A = this.A;
    for (let j = 0; j < this.P; j++) {
      A.cx[j] = shape === "han" ? A.hx[j] : A.lx[j];
      A.cy[j] = shape === "han" ? A.hy[j] : A.ly[j];
      A.cs[j] = 1;
      A.ca[j] = 0;
    }
  }

  /** The seal 付优扬印, carved out of a cinnabar square with slightly uneven paste. */
  private makeSeal(Z: number) {
    const s = Math.max(8, Math.ceil(Z * this.dpr));
    const off = document.createElement("canvas");
    off.width = off.height = s;
    const o = off.getContext("2d");
    if (!o) return off;
    const r = rng(616);
    const j = s * 0.012;
    const n = 18;
    o.fillStyle = this.colors.cinnabar;
    o.beginPath();
    for (let i = 0; i <= n; i++) o.lineTo((i / n) * s, j * r());
    for (let i = 0; i <= n; i++) o.lineTo(s - j * r(), (i / n) * s);
    for (let i = n; i >= 0; i--) o.lineTo((i / n) * s, s - j * r());
    for (let i = n; i >= 0; i--) o.lineTo(j * r(), (i / n) * s);
    o.closePath();
    o.fill();

    o.globalCompositeOperation = "destination-out";
    const pad = s * 0.09;
    const gp = s * 0.035;
    const q = (s - 2 * pad - gp) / 2;
    const grow = 1.1;
    const k = (q * grow) / GLYPH_BOX;
    SEAL_GRID.forEach((row, ri) =>
      row.forEach((char, ci) => {
        const x = pad + ci * (q + gp) - (q * (grow - 1)) / 2;
        const y = pad + ri * (q + gp) - (q * (grow - 1)) / 2;
        o.setTransform(k, 0, 0, -k, x, y + GLYPH_BASELINE * k);
        o.lineWidth = 34;
        o.lineJoin = "round";
        for (const d of glyph(char).strokes) {
          const path = new Path2D(d);
          o.fill(path);
          o.stroke(path);
        }
      }),
    );
    o.setTransform(1, 0, 0, 1, 0, 0);
    const specks = Math.round(s * s * 0.004);
    for (let i = 0; i < specks; i++) {
      let x = r() * s;
      let y = r() * s;
      if (r() < 0.45) {
        const side = Math.floor(r() * 4);
        if (side === 0) y = r() * s * 0.06;
        else if (side === 1) x = s - r() * s * 0.06;
        else if (side === 2) y = s - r() * s * 0.06;
        else x = r() * s * 0.06;
      }
      o.globalAlpha = 0.2 + 0.7 * r();
      o.beginPath();
      o.arc(x, y, (0.3 + r() * 1.1) * this.dpr * 0.7, 0, Math.PI * 2);
      o.fill();
    }
    o.globalAlpha = 1;
    o.globalCompositeOperation = "source-over";
    return off;
  }

  /* ---------- morph ---------- */

  private startMorph(to: Shape) {
    if (this.target === to) return;
    this.hFrom = this.hNow;
    this.target = to;
    if (this.opts.reduced) {
      this.morph = null;
      this.shape = to;
      this.hNow = to === "han" ? 1 : 0;
      this.restAt(to);
      this.emitLayout();
      return;
    }
    const A = this.A;
    const { S, left, hanW } = this.G;
    const P = this.P;
    for (let j = 0; j < P; j++) {
      const fx = A.cx[j];
      const fy = A.cy[j];
      const tx = to === "han" ? A.hx[j] : A.lx[j];
      const ty = to === "han" ? A.hy[j] : A.ly[j];
      A.fx[j] = fx;
      A.fy[j] = fy;
      A.fs[j] = A.cs[j];
      A.fa[j] = A.ca[j];
      // Each square tumbles a quarter turn, so it lands square on the lattice again.
      A.ta[j] = Math.round((A.ca[j] + (A.dir[j] * Math.PI) / 2) / (Math.PI / 2)) * (Math.PI / 2);
      const dist = Math.hypot(tx - fx, ty - fy);
      const lift = Math.min(dist * 0.5 + S * 0.12, S * 0.75) * (0.55 + 0.45 * A.r[j]);
      A.kx[j] = (fx + tx) / 2 + (A.r[(j * 7) % P] - 0.5) * S * 0.35;
      A.ky[j] = (fy + ty) / 2 - lift;
      A.delay[j] = SPREAD * D_FLIGHT * clamp((fx - left) / hanW) + A.r[(j * 13) % P] * 0.1 * D_FLIGHT;
    }
    this.morph = { start: this.T, to };
  }

  private currentH() {
    if (!this.morph) return this.shape === "han" ? 1 : 0;
    const p = ease.settle(clamp((this.T - this.morph.start) / (D_FLIGHT * (1 + SPREAD))));
    return lerp(this.hFrom, this.morph.to === "han" ? 1 : 0, p);
  }

  /* ---------- drawing ---------- */

  private drawGrid(p: number) {
    if (p <= 0.002) return;
    const { ctx, dpr } = this;
    const { S, gap, left, hanTop } = this.G;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.strokeStyle = this.colors.grid;
    ctx.lineWidth = 1;
    for (let ci = 0; ci < this.glyphs.length; ci++) {
      const bx = left + ci * (S + gap);
      const cx = bx + S / 2;
      const cy = hanTop + S / 2;
      const half = (S / 2) * p;
      ctx.globalAlpha = 1;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(cx - half, cy);
      ctx.lineTo(cx + half, cy);
      ctx.moveTo(cx, cy - half);
      ctx.lineTo(cx, cy + half);
      ctx.moveTo(cx - half, cy - half);
      ctx.lineTo(cx + half, cy + half);
      ctx.moveTo(cx + half, cy - half);
      ctx.lineTo(cx - half, cy + half);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = p;
      ctx.strokeRect(bx + 0.5, hanTop + 0.5, S - 1, S - 1);
    }
    ctx.globalAlpha = 1;
  }

  private drawPinyin(alpha: number) {
    const { pinyin, fontFamily } = this.opts;
    if (!pinyin || alpha <= 0.002) return;
    const { ctx, dpr, T } = this;
    const { S, gap, left, hanTop } = this.G;
    const fs = Math.max(12, Math.min(17, S * 0.075));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = `500 ${fs}px ${fontFamily}`;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    const y = hanTop + S + fs * 2.1;
    pinyin.forEach((p, i) => {
      const a = alpha * ease.out(clamp((T - this.tl.pinyin - i * 110) / 480));
      if (a <= 0.002) return;
      const centre = left + i * (S + gap) + S / 2;
      const tw = ctx.measureText(p.text).width;
      const cw = fs * 1.15;
      const ch = fs * 0.78;
      const sp = fs * 0.5;
      const x0 = centre - (tw + sp + cw) / 2;
      const rise = (1 - a) * 6;
      ctx.globalAlpha = a;
      ctx.fillStyle = this.colors.inkSoft;
      ctx.fillText(p.text, x0, y + rise);
      // The tone as a tiny chart on the Chao scale, with its reference bar on the right.
      const top = y - fs * 0.74 + rise;
      const bx = x0 + tw + sp;
      const level = (l: number) => top + (ch * (5 - l)) / 4;
      ctx.strokeStyle = this.colors.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bx + cw + 3.5, top);
      ctx.lineTo(bx + cw + 3.5, top + ch);
      ctx.stroke();
      const drawn = ease.settle(clamp((T - this.tl.pinyin - i * 110 - 160) / 520));
      if (drawn > 0) {
        const ya = level(p.chao[0]);
        const yb = level(p.chao[1]);
        ctx.strokeStyle = this.colors.inkSoft;
        ctx.lineWidth = 1.5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(bx, ya);
        ctx.lineTo(lerp(bx, bx + cw, drawn), lerp(ya, yb, drawn));
        ctx.stroke();
        if (drawn > 0.97) {
          ctx.fillStyle = this.colors.cinnabar;
          ctx.beginPath();
          ctx.arc(bx + cw, yb, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });
    ctx.globalAlpha = 1;
  }

  private near(x: number, y: number) {
    const p = this.pointer;
    if (p.s <= 0.001) return 1;
    const R = this.G.S * 0.6;
    const dx = x - p.x;
    const dy = y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 >= R * R) return 1;
    const k = 1 - Math.sqrt(d2) / R;
    return 1 + 0.55 * k * k * p.s;
  }

  private drawParticles() {
    const { ctx, dpr, A, P, T } = this;
    const base = this.G.c * 0.8 * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (this.morph) {
      ctx.fillStyle = this.colors.ink;
      const elapsed = T - this.morph.start;
      const toHan = this.morph.to === "han";
      for (let j = 0; j < P; j++) {
        const e = clamp((elapsed - A.delay[j]) / D_FLIGHT);
        const ee = ease.flight(e);
        const tx = toHan ? A.hx[j] : A.lx[j];
        const ty = toHan ? A.hy[j] : A.ly[j];
        const u = 1 - ee;
        const x = u * u * A.fx[j] + 2 * u * ee * A.kx[j] + ee * ee * tx;
        const y = u * u * A.fy[j] + 2 * u * ee * A.ky[j] + ee * ee * ty;
        const s = lerp(A.fs[j], 1, ee) + A.bump[j] * Math.sin(Math.PI * ee);
        const a = lerp(A.fa[j], A.ta[j], ee);
        A.cx[j] = x;
        A.cy[j] = y;
        A.cs[j] = s;
        A.ca[j] = a;
        const size = base * s;
        if (e <= 0 || e >= 1) {
          const sz = Math.round(size * this.near(x, y));
          ctx.fillRect(Math.round(x * dpr - sz / 2), Math.round(y * dpr - sz / 2), sz, sz);
        } else {
          const cs = Math.cos(a);
          const sn = Math.sin(a);
          ctx.setTransform(cs, sn, -sn, cs, x * dpr, y * dpr);
          ctx.fillRect(-size / 2, -size / 2, size, size);
          ctx.setTransform(1, 0, 0, 1, 0, 0);
        }
      }
      if (elapsed >= D_MORPH) {
        this.shape = this.morph.to;
        this.morph = null;
        for (let j = 0; j < P; j++) {
          A.cs[j] = 1;
          A.ca[j] = 0;
        }
      }
      return;
    }

    if (this.shape === "han") {
      // Being written, then resting as characters.
      let anyWet = false;
      ctx.fillStyle = this.colors.ink;
      for (let j = 0; j < P; j++) {
        if (A.dupH[j]) continue;
        const age = T - A.rev[j];
        if (age < 0) continue;
        if (age < WET) {
          anyWet = true;
          continue;
        }
        const x = A.hx[j];
        const y = A.hy[j];
        const sz = Math.round(base * this.near(x, y));
        ctx.fillRect(Math.round(x * dpr - sz / 2), Math.round(y * dpr - sz / 2), sz, sz);
      }
      if (anyWet) {
        for (let b = 0; b < WET_STEPS - 1; b++) {
          ctx.fillStyle = this.wet[b];
          for (let j = 0; j < P; j++) {
            if (A.dupH[j]) continue;
            const age = T - A.rev[j];
            if (age < 0 || age >= WET) continue;
            if (Math.min(WET_STEPS - 2, Math.floor((age / WET) * (WET_STEPS - 1))) !== b) continue;
            const sz = base * (age < SCALE_IN ? backOut(age / SCALE_IN) : 1);
            ctx.fillRect(A.hx[j] * dpr - sz / 2, A.hy[j] * dpr - sz / 2, sz, sz);
          }
        }
      }
      return;
    }

    // Resting as the Latin word, with the small shock from the stamp.
    ctx.fillStyle = this.colors.ink;
    let wave: { amp: number; x: number; y: number; R: number } | null = null;
    if (this.shock) {
      const age = T - this.shock.t;
      if (age > 700) this.shock = null;
      else wave = { amp: this.G.c * 0.75 * Math.exp(-age / 120) * Math.sin(age / 36), x: this.shock.x, y: this.shock.y, R: this.G.S * 1.5 };
    }
    for (let j = 0; j < P; j++) {
      if (A.dupL[j]) continue;
      let x = A.lx[j];
      let y = A.ly[j];
      if (wave) {
        const dx = x - wave.x;
        const dy = y - wave.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < wave.R) {
          const push = wave.amp * Math.pow(1 - d / wave.R, 2);
          x += (dx / d) * push;
          y += (dy / d) * push;
        }
      }
      const sz = Math.round(base * this.near(x, y));
      ctx.fillRect(Math.round(x * dpr - sz / 2), Math.round(y * dpr - sz / 2), sz, sz);
    }
  }

  private sealPos(h: number) {
    const { sealLat, sealHan } = this.G;
    return { x: lerp(sealLat.x, sealHan.x, h), y: lerp(sealLat.y, sealHan.y, h) };
  }

  private drawSeal(h: number) {
    if (!this.sealCanvas || this.T < this.tl.stamp) return;
    const { ctx, dpr } = this;
    const k = clamp((this.T - this.tl.stamp) / D_STAMP);
    const Z = this.G.Z;
    const pos = this.sealPos(h);
    const IMPACT = 0.42;
    let scale: number, rot: number, alpha: number, blur: number, drop: number, shade: number;
    if (k < IMPACT) {
      const q = k / IMPACT;
      const fall = Math.pow(q, 2.2);
      scale = 1.6 - 0.63 * fall;
      rot = -8 + 5.5 * fall;
      alpha = clamp(q * 2.4);
      blur = 26 * (1 - q) + 2;
      drop = 16 * (1 - q) + 1;
      shade = 0.28;
    } else {
      const q = ease.settle((k - IMPACT) / (1 - IMPACT));
      scale = 0.97 + 0.03 * q;
      rot = -2.5 + 0.5 * q;
      alpha = 1;
      blur = 2;
      drop = 1;
      shade = 0.28 * (1 - q);
      if (!this.shocked) {
        this.shocked = true;
        this.shock = { t: this.T, x: pos.x + Z / 2, y: pos.y + Z / 2 };
      }
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(pos.x + Z / 2, pos.y + Z / 2);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    if (shade > 0.01) {
      ctx.shadowColor = `rgba(0,0,0,${shade})`;
      ctx.shadowBlur = blur * dpr;
      ctx.shadowOffsetY = drop * dpr;
    }
    ctx.drawImage(this.sealCanvas, -Z / 2, -Z / 2, Z, Z);
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  private emitLayout() {
    const { onLayout, seal, latin } = this.opts;
    if (!onLayout || !this.G) return;
    const { hanRect: a, latRect: b, c, Z, S, baseline } = this.G;
    const pad = c * 3;
    const x = Math.min(a.x, b.x) - pad;
    const y = Math.min(a.y, b.y) - pad;
    const pos = this.sealPos(this.hNow);
    onLayout({
      name: {
        x,
        y,
        w: Math.max(a.x + a.w, b.x + b.w) + pad - x,
        h: Math.max(a.y + a.h, b.y + b.h) + pad - y,
      },
      seal: seal ? { x: pos.x, y: pos.y, w: Z, h: Z } : null,
      textTop: latin ? baseline + S * 0.2 : a.y + a.h + S * 0.34,
      han: this.hNow,
    });
  }

  /* ---------- loop ---------- */

  private wake() {
    if (this.running || this.destroyed || !this.visible || !this.G) return;
    this.running = true;
    this.last = 0;
    this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number) => {
    if (this.destroyed) return;
    if (!this.visible || document.hidden) {
      this.running = false;
      return;
    }
    const dt = Math.min(64, now - (this.last || now));
    this.last = now;
    this.T += dt * this.speed;
    const p = this.pointer;
    p.s += ((p.active ? 1 : 0) - p.s) * Math.min(1, dt / 140);

    if (!this.introMorphDone && this.T >= this.tl.morph) {
      this.introMorphDone = true;
      this.startMorph("lat");
    }

    const hBefore = this.hNow;
    this.hNow = this.currentH();
    const { ctx } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawGrid(ease.out(clamp(this.T / 800)) * ease.settle(this.hNow));
    this.drawPinyin(clamp(this.hNow * 1.7 - 0.7));
    this.drawParticles();
    this.drawSeal(this.hNow);
    if (hBefore !== this.hNow) this.emitLayout();

    if (!this.idleFired && this.T >= this.tl.idle) {
      this.idleFired = true;
      this.speed = 1;
      this.emitLayout();
      this.opts.onIdle?.();
    }

    // At rest with nothing changing: stop drawing until something wakes the scene.
    const settled = this.idleFired && !this.morph && !this.shock && !p.active && p.s < 0.002 && this.T > this.tl.idle + 800;
    if (settled) {
      this.running = false;
      return;
    }
    this.raf = requestAnimationFrame(this.frame);
  };
}

/** Nearest point on a stroke's centre line: how far along it (0 to 1) and how far from it. */
function projectOnto(m: { pts: number[][]; cum: number[]; len: number }, x: number, y: number) {
  const p = m.pts;
  if (p.length < 2) return { u: 0, d: Math.hypot(x - p[0][0], y - p[0][1]) };
  let best = Infinity;
  let along = 0;
  for (let i = 0; i < p.length - 1; i++) {
    const ax = p[i][0];
    const ay = p[i][1];
    const vx = p[i + 1][0] - ax;
    const vy = p[i + 1][1] - ay;
    const l2 = vx * vx + vy * vy || 1;
    const t = clamp(((x - ax) * vx + (y - ay) * vy) / l2);
    const qx = ax + t * vx;
    const qy = ay + t * vy;
    const d = (x - qx) * (x - qx) + (y - qy) * (y - qy);
    if (d < best) {
      best = d;
      along = m.cum[i] + t * Math.sqrt(l2);
    }
  }
  return { u: along / m.len, d: Math.sqrt(best) };
}

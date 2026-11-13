import type MatterNS from "matter-js";
import { clamp, ease, lerp, prefersReducedMotion, rng } from "@/lib/motion";

// The physics behind the Stack chapter's blocks. The blocks are DOM elements
// laid out by CSS at their home slots; this controller only ever moves them
// with a transform (offset from home, plus rotation), so the server-rendered
// layout is the resting state and nothing shifts when the script starts.
//
// Three modes:
//   scroll  - before anyone touches a block, the blocks follow scroll progress
//             from scattered positions into their homes. Bodies sit static.
//   physics - after the first grab: gravity, collisions, drag and throw.
//   reset   - every block flies home on an arc, then back to "scroll".

type Matter = typeof MatterNS;
type Body = MatterNS.Body;

export type StackMode = "scroll" | "physics" | "reset";

/** Centre and size of a block's home slot, in region coordinates (inside the border). */
type Home = { x: number; y: number; w: number; h: number };
/** An offset from home and an angle. */
type Pose = { x: number; y: number; a: number };

type Held = { index: number; constraint: MatterNS.Constraint; clientX: number; clientY: number };

/** Fixed physics step: two steps per 60 Hz frame keeps fast throws from tunnelling through the shelf. */
const STEP = 1000 / 120;
const MAX_STEPS = 12;
const GRAVITY = 0.0018;
/** Speed limits, in pixels and radians per 1/60 s. */
const MAX_SPEED = 40;
const MAX_SPIN = 0.35;
/** Below these for REST_FRAMES frames in a row, with nothing held, the loop stops. */
const REST_SPEED = 0.06;
const REST_SPIN = 0.002;
const REST_FRAMES = 45;
/** Displacement that counts as "the visitor moved something", which enables Reset. */
const MOVED_PX = 2;
const MOVED_RAD = 0.03;

/** Scroll assembly: the region's top travels from the viewport bottom to this fraction of the way up. */
const ASSEMBLY_TRAVEL = 0.6;
/** Share of the scroll range spent staggering block starts. */
const ASSEMBLY_STAGGER = 0.25;

const RESET_MS = 800;
const RESET_STAGGER_MS = 25;

/** Thickness of the invisible walls outside the region. Thick, so nothing can pass through. */
const WALL = 400;

const TAU = Math.PI * 2;
const normalizeAngle = (a: number) => a - TAU * Math.round(a / TAU);

export class StackPlay {
  private readonly region: HTMLElement;
  private readonly towers: HTMLElement[];
  private readonly blocks: HTMLElement[];
  private readonly shelf: HTMLElement | null;
  /** Order in which blocks land: bottom rows first. */
  private readonly rank: number[];
  private readonly onMoved: (moved: boolean) => void;

  private M: Matter | null = null;
  private engine: MatterNS.Engine | null = null;
  private bodies: Body[] = [];

  private W = 0;
  private H = 0;
  private homes: Home[] = [];
  private shelfRect: { x: number; y: number; w: number; h: number } | null = null;
  private scatter: Pose[] = [];
  /** Last values written to each block, so unchanged blocks are skipped. */
  private written: { x: number; y: number; a: number; o: number }[] = [];

  private mode: StackMode = "scroll";
  private moved = false;
  private held = new Map<number, Held>();
  private progress = 1;
  private atRest = true;
  private restFrames = 0;

  private resetAt = 0;
  private resetFrom: Pose[] = [];
  private resetVia: { x: number; y: number }[] = [];

  private raf = 0;
  private scrollRaf = 0;
  private last = 0;
  private acc = 0;
  private onScreen = false;
  private near = false;
  private reduced = prefersReducedMotion();
  private destroyed = false;

  private readonly io: IntersectionObserver;
  private readonly nearIo: IntersectionObserver;
  private readonly ro: ResizeObserver;
  private readonly motionQuery: MediaQueryList;

  constructor(region: HTMLElement, onMoved: (moved: boolean) => void) {
    this.region = region;
    this.onMoved = onMoved;
    this.towers = Array.from(region.querySelectorAll<HTMLElement>("[data-tower]"));
    this.blocks = Array.from(region.querySelectorAll<HTMLElement>("[data-block]"));
    this.shelf = region.querySelector<HTMLElement>("[data-shelf]");
    this.rank = this.blocks.map((el) => Number(el.dataset.rank) || 0);
    this.written = this.blocks.map(() => ({ x: 0, y: 0, a: 0, o: 1 }));

    for (const el of this.blocks) el.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("scroll", this.onScroll, { passive: true });
    window.addEventListener("resize", this.onScroll, { passive: true });
    document.addEventListener("visibilitychange", this.onVisibility);
    this.motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.motionQuery.addEventListener("change", this.onMotionPreference);

    this.io = new IntersectionObserver(([entry]) => {
      this.onScreen = entry.isIntersecting;
      if (this.onScreen) this.ensureLoop();
    });
    this.io.observe(region);

    // Within a screen of the viewport: load the engine and follow the scroll.
    this.nearIo = new IntersectionObserver(
      ([entry]) => {
        this.near = entry.isIntersecting;
        if (this.near) void this.loadEngine();
        this.onScroll();
      },
      { rootMargin: "100% 0px 100% 0px" },
    );
    this.nearIo.observe(region);

    this.ro = new ResizeObserver(() => this.measure());
    this.ro.observe(region);
    for (const tower of this.towers) this.ro.observe(tower);
    void document.fonts?.ready.then(() => this.measure());

    this.measure();
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    cancelAnimationFrame(this.scrollRaf);
    for (const id of [...this.held.keys()]) this.release(id);
    for (const el of this.blocks) el.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("scroll", this.onScroll);
    window.removeEventListener("resize", this.onScroll);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.motionQuery.removeEventListener("change", this.onMotionPreference);
    this.io.disconnect();
    this.nearIo.disconnect();
    this.ro.disconnect();
    if (this.M && this.engine) {
      this.M.Composite.clear(this.engine.world, false, true);
      this.M.Engine.clear(this.engine);
    }
    this.engine = null;
  }

  /** Sends every block home along an arc. */
  reset() {
    const M = this.M;
    if (this.mode !== "physics" || !M) return;
    for (const id of [...this.held.keys()]) this.release(id);

    this.resetFrom = this.bodies.map((body, i) => {
      const a = normalizeAngle(body.angle);
      M.Body.setStatic(body, true);
      M.Body.setAngle(body, a);
      return { x: body.position.x - this.homes[i].x, y: body.position.y - this.homes[i].y, a };
    });
    this.setMoved(false);

    if (this.reduced) {
      this.finishReset();
      return;
    }

    // A control point lifted above the higher end, never so high the arc leaves the region:
    // a quadratic bezier never rises more than half the lift above its higher end.
    this.resetVia = this.resetFrom.map((from, i) => {
      const home = this.homes[i];
      const sx = home.x + from.x;
      const sy = home.y + from.y;
      const top = Math.min(sy, home.y);
      const distance = Math.hypot(from.x, from.y);
      const room = Math.max(0, 2 * (top - home.h / 2 - 2));
      const lift = Math.min(clamp(distance * 0.35 + 40, 40, 180), room);
      return { x: (sx + home.x) / 2, y: top - lift };
    });

    this.setMode("reset");
    this.resetAt = performance.now();
    this.ensureLoop();
  }

  // Layout -----------------------------------------------------------------

  /** Reads the home slots from the CSS layout. Transforms don't affect these measurements. */
  private measure() {
    if (this.destroyed) return;
    const origin = this.region.getBoundingClientRect();
    const ox = origin.left + this.region.clientLeft;
    const oy = origin.top + this.region.clientTop;
    const W = this.region.clientWidth;
    const H = this.region.clientHeight;

    const homes: Home[] = [];
    for (const tower of this.towers) {
      const t = tower.getBoundingClientRect();
      for (const el of tower.querySelectorAll<HTMLElement>("[data-block]")) {
        homes.push({ x: t.left - ox + t.width / 2, y: t.top - oy + el.offsetTop + el.offsetHeight / 2, w: t.width, h: el.offsetHeight });
      }
    }
    const s = this.shelf?.getBoundingClientRect();
    const shelfRect = s && s.width > 0 ? { x: s.left - ox, y: s.top - oy, w: s.width, h: s.height } : null;

    const close = (a: Home | null, b: Home | null) =>
      a === b ||
      (a !== null && b !== null && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.w - b.w) < 0.5 && Math.abs(a.h - b.h) < 0.5);
    const same =
      W === this.W &&
      H === this.H &&
      close(shelfRect, this.shelfRect) &&
      homes.length === this.homes.length &&
      homes.every((h, i) => close(h, this.homes[i]));
    if (same) return;

    this.W = W;
    this.H = H;
    this.homes = homes;
    this.shelfRect = shelfRect;
    this.scatter = homes.map((home, i) => {
      const r = rng(7919 * (i + 1));
      const x = lerp(home.w / 2, W - home.w / 2, r());
      const y = Math.min(lerp(-0.75 * H, 0.35 * H, r()), home.y - 0.25 * H);
      const a = (r() - 0.5) * 1.7;
      return { x: x - home.x, y: y - home.y, a };
    });

    // A new layout puts every block back home.
    for (const id of [...this.held.keys()]) this.release(id);
    this.buildWorld();
    this.setMode("scroll");
    this.setMoved(false);
    this.renderAssembly();
  }

  private async loadEngine() {
    if (this.M) return;
    const mod = await import("matter-js");
    if (this.destroyed || this.M) return;
    this.M = (mod.default ?? mod) as Matter;
    this.buildWorld();
  }

  private buildWorld() {
    const M = this.M;
    if (!M || this.W === 0) return;
    if (!this.engine) {
      this.engine = M.Engine.create({
        gravity: { x: 0, y: 1, scale: GRAVITY },
        enableSleeping: false,
        positionIterations: 10,
        velocityIterations: 8,
        constraintIterations: 4,
      });
    } else {
      M.Composite.clear(this.engine.world, false, true);
    }
    const { W, H } = this;
    const walls = [
      M.Bodies.rectangle(W / 2, H + WALL / 2, W + WALL * 2, WALL, { isStatic: true }),
      M.Bodies.rectangle(W / 2, -WALL / 2, W + WALL * 2, WALL, { isStatic: true }),
      M.Bodies.rectangle(-WALL / 2, H / 2, WALL, H + WALL * 2, { isStatic: true }),
      M.Bodies.rectangle(W + WALL / 2, H / 2, WALL, H + WALL * 2, { isStatic: true }),
    ];
    if (this.shelfRect) {
      const s = this.shelfRect;
      walls.push(M.Bodies.rectangle(s.x + s.w / 2, s.y + s.h / 2, s.w, s.h, { isStatic: true }));
    }
    this.bodies = this.homes.map((home) => {
      const body = M.Bodies.rectangle(home.x, home.y, home.w, home.h, {
        density: 0.0016,
        friction: 0.55,
        frictionStatic: 0.9,
        frictionAir: 0.012,
        restitution: 0.12,
        slop: 0.02,
      });
      // Created dynamic first so Matter remembers the mass to restore later.
      M.Body.setStatic(body, true);
      return body;
    });
    M.Composite.add(this.engine.world, [...walls, ...this.bodies]);
    this.atRest = true;
  }

  // Scroll assembly ---------------------------------------------------------

  private onScroll = () => {
    if (this.mode !== "scroll" || this.scrollRaf) return;
    // Far from the viewport, the blocks already sit at the end of their path.
    if (!this.near && (this.progress === 0 || this.progress === 1)) return;
    this.scrollRaf = requestAnimationFrame(() => {
      this.scrollRaf = 0;
      if (this.mode === "scroll") this.renderAssembly();
    });
  };

  private scrollProgress() {
    const top = this.region.getBoundingClientRect().top;
    const vh = window.innerHeight;
    // Where the region's top ends up with the page scrolled to the bottom: if the page
    // can't lift it far enough, the assembly completes there instead.
    const lowest = top + window.scrollY - (document.documentElement.scrollHeight - vh);
    const end = Math.max((1 - ASSEMBLY_TRAVEL) * vh, lowest);
    return end >= vh ? 1 : clamp((vh - top) / (vh - end));
  }

  /** Places every block on its path from scattered to home for the current scroll position. */
  private renderAssembly() {
    const p = this.reduced ? 1 : this.scrollProgress();
    this.progress = p;
    this.region.toggleAttribute("data-assembling", p < 1);
    const last = Math.max(1, this.blocks.length - 1);
    for (let i = 0; i < this.blocks.length; i++) {
      const delay = (ASSEMBLY_STAGGER * this.rank[i]) / last;
      const t = clamp((p - delay) / (1 - ASSEMBLY_STAGGER));
      if (t >= 1 || !this.scatter[i]) {
        this.write(i, 0, 0, 0);
        continue;
      }
      // A quadratic bezier from the scattered pose to home, its control point
      // straight above home: the block drifts sideways first, then drops in.
      const e = ease.flight(t);
      const s = this.scatter[i];
      const u = 1 - e;
      this.write(i, s.x * u * u, s.y * (1 - e * e), s.a * u, clamp(t * 4));
    }
  }

  // Pointer ----------------------------------------------------------------

  private onPointerDown = (event: PointerEvent) => {
    const M = this.M;
    const el = event.currentTarget as HTMLElement;
    const index = this.blocks.indexOf(el);
    if (!M || !this.engine || index < 0 || this.mode === "reset") return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (this.mode === "scroll" && this.progress < 1) return;
    for (const h of this.held.values()) if (h.index === index) return;

    event.preventDefault();
    if (this.mode === "scroll") this.startPhysics();

    try {
      el.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic or already-ended pointers can't be captured; window listeners still follow them.
    }
    const point = this.toRegion(event.clientX, event.clientY);
    const body = this.bodies[index];
    const constraint = M.Constraint.create({
      pointA: point,
      bodyB: body,
      pointB: { x: point.x - body.position.x, y: point.y - body.position.y },
      length: 0,
      stiffness: 0.2,
      // Angular stiffness stays at Matter's default of 0, so a block held off-centre swings.
      damping: 0.1,
    });
    M.Composite.add(this.engine.world, constraint);

    if (this.held.size === 0) {
      window.addEventListener("pointermove", this.onPointerMove);
      window.addEventListener("pointerup", this.onPointerUp);
      window.addEventListener("pointercancel", this.onPointerUp);
    }
    el.addEventListener("lostpointercapture", this.onPointerUp);
    this.held.set(event.pointerId, { index, constraint, clientX: event.clientX, clientY: event.clientY });
    el.setAttribute("data-held", "");
    this.region.setAttribute("data-holding", "");
    this.atRest = false;
    this.restFrames = 0;
    this.ensureLoop();
  };

  private onPointerMove = (event: PointerEvent) => {
    const held = this.held.get(event.pointerId);
    if (!held) return;
    held.clientX = event.clientX;
    held.clientY = event.clientY;
  };

  private onPointerUp = (event: PointerEvent) => this.release(event.pointerId);

  /** Lets go of a block. It keeps its velocity, so a fast release is a throw. */
  private release(pointerId: number) {
    const held = this.held.get(pointerId);
    if (!held) return;
    this.held.delete(pointerId);
    if (this.M && this.engine) this.M.Composite.remove(this.engine.world, held.constraint);
    const el = this.blocks[held.index];
    el.removeAttribute("data-held");
    el.removeEventListener("lostpointercapture", this.onPointerUp);
    try {
      if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
    } catch {}
    if (this.held.size === 0) {
      this.region.removeAttribute("data-holding");
      window.removeEventListener("pointermove", this.onPointerMove);
      window.removeEventListener("pointerup", this.onPointerUp);
      window.removeEventListener("pointercancel", this.onPointerUp);
    }
  }

  private toRegion(clientX: number, clientY: number) {
    const r = this.region.getBoundingClientRect();
    return {
      x: clamp(clientX - r.left - this.region.clientLeft, 0, this.W),
      y: clamp(clientY - r.top - this.region.clientTop, 0, this.H),
    };
  }

  // Physics ------------------------------------------------------------------

  private startPhysics() {
    const M = this.M;
    if (!M) return;
    for (const body of this.bodies) {
      M.Body.setStatic(body, false);
      M.Body.setVelocity(body, { x: 0, y: 0 });
      M.Body.setAngularVelocity(body, 0);
    }
    this.region.removeAttribute("data-assembling");
    this.setMode("physics");
  }

  private stepPhysics(dt: number) {
    const M = this.M;
    const engine = this.engine;
    if (!M || !engine) return;

    if (this.held.size) {
      // Read the pointers against the region once a frame: the page may scroll under a held block.
      const r = this.region.getBoundingClientRect();
      const ox = r.left + this.region.clientLeft;
      const oy = r.top + this.region.clientTop;
      for (const held of this.held.values()) {
        held.constraint.pointA.x = clamp(held.clientX - ox, 0, this.W);
        held.constraint.pointA.y = clamp(held.clientY - oy, 0, this.H);
      }
    }

    this.acc += dt;
    let steps = 0;
    while (this.acc >= STEP && steps < MAX_STEPS) {
      M.Engine.update(engine, STEP);
      this.contain();
      this.acc -= STEP;
      steps++;
    }
    if (steps === MAX_STEPS) this.acc = 0;

    let calm = this.held.size === 0;
    for (let i = 0; i < this.bodies.length; i++) {
      const body = this.bodies[i];
      const home = this.homes[i];
      const x = body.position.x - home.x;
      const y = body.position.y - home.y;
      this.write(i, x, y, body.angle);
      if (!this.moved && (Math.abs(x) > MOVED_PX || Math.abs(y) > MOVED_PX || Math.abs(normalizeAngle(body.angle)) > MOVED_RAD)) {
        this.setMoved(true);
      }
      if (calm && (M.Body.getSpeed(body) > REST_SPEED || Math.abs(M.Body.getAngularVelocity(body)) > REST_SPIN)) calm = false;
    }
    this.restFrames = calm ? this.restFrames + 1 : 0;
    this.atRest = this.restFrames >= REST_FRAMES;
  }

  /** Caps speed and puts back anything that somehow got past a wall. */
  private contain() {
    const M = this.M!;
    for (let i = 0; i < this.bodies.length; i++) {
      const body = this.bodies[i];
      const v = M.Body.getVelocity(body);
      const speed = Math.hypot(v.x, v.y);
      if (speed > MAX_SPEED) M.Body.setVelocity(body, { x: (v.x / speed) * MAX_SPEED, y: (v.y / speed) * MAX_SPEED });
      const spin = M.Body.getAngularVelocity(body);
      if (Math.abs(spin) > MAX_SPIN) M.Body.setAngularVelocity(body, Math.sign(spin) * MAX_SPIN);

      const { x, y } = body.position;
      if (x < 0 || x > this.W || y < 0 || y > this.H) {
        const m = Math.min(this.homes[i].w, this.homes[i].h) / 2;
        M.Body.setPosition(body, { x: clamp(x, m, this.W - m), y: clamp(y, m, this.H - m) });
        M.Body.setVelocity(body, { x: 0, y: 0 });
      }
    }
  }

  // Reset ----------------------------------------------------------------------

  private stepReset(now: number) {
    const M = this.M;
    if (!M) return;
    let done = true;
    for (let i = 0; i < this.bodies.length; i++) {
      const local = clamp((now - this.resetAt - this.rank[i] * RESET_STAGGER_MS) / RESET_MS);
      if (local < 1) done = false;
      const e = ease.flight(local);
      const u = 1 - e;
      const home = this.homes[i];
      const from = this.resetFrom[i];
      const via = this.resetVia[i];
      const x = u * u * (home.x + from.x) + 2 * u * e * via.x + e * e * home.x;
      const y = u * u * (home.y + from.y) + 2 * u * e * via.y + e * e * home.y;
      const a = from.a * u;
      M.Body.setPosition(this.bodies[i], { x, y });
      M.Body.setAngle(this.bodies[i], a);
      this.write(i, x - home.x, y - home.y, a);
    }
    if (done) this.finishReset();
  }

  private finishReset() {
    const M = this.M;
    if (!M) return;
    for (let i = 0; i < this.bodies.length; i++) {
      const body = this.bodies[i];
      M.Body.setPosition(body, { x: this.homes[i].x, y: this.homes[i].y });
      M.Body.setAngle(body, 0);
      this.write(i, 0, 0, 0);
    }
    this.atRest = true;
    this.restFrames = 0;
    this.setMode("scroll");
    this.renderAssembly();
  }

  // Frame loop ----------------------------------------------------------------

  private wantsFrames() {
    if (this.destroyed || !this.onScreen || document.hidden) return false;
    return this.mode === "reset" || (this.mode === "physics" && !this.atRest);
  }

  private ensureLoop() {
    if (this.raf || !this.wantsFrames()) return;
    this.last = performance.now();
    this.acc = 0;
    this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number) => {
    this.raf = 0;
    const dt = Math.min(Math.max(now - this.last, 0), 100);
    this.last = now;
    if (this.mode === "reset") this.stepReset(now);
    else if (this.mode === "physics") this.stepPhysics(dt);
    if (this.wantsFrames()) this.raf = requestAnimationFrame(this.frame);
  };

  private onVisibility = () => {
    if (!document.hidden) this.ensureLoop();
  };

  private onMotionPreference = () => {
    this.reduced = this.motionQuery.matches;
    if (this.mode === "scroll") this.renderAssembly();
  };

  // Output ----------------------------------------------------------------------

  private setMode(mode: StackMode) {
    this.mode = mode;
    this.region.dataset.mode = mode;
  }

  private setMoved(moved: boolean) {
    if (this.moved === moved) return;
    this.moved = moved;
    this.onMoved(moved);
  }

  /** Moves block i to an offset from home and an angle, skipping writes that change nothing. */
  private write(i: number, x: number, y: number, a: number, o = 1) {
    const w = this.written[i];
    // Hair-thin tilts and sub-pixel drift are drawn square, so text at rest stays crisp.
    const angle = Math.abs(a) < 0.0015 ? 0 : a;
    const dx = Math.abs(x) < 0.01 ? 0 : x;
    const dy = Math.abs(y) < 0.01 ? 0 : y;
    if (Math.abs(w.x - dx) < 0.01 && Math.abs(w.y - dy) < 0.01 && Math.abs(w.a - angle) < 0.0005 && Math.abs(w.o - o) < 0.005) return;
    w.x = dx;
    w.y = dy;
    w.a = angle;
    w.o = o;
    const style = this.blocks[i].style;
    style.transform = dx || dy || angle ? `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) rotate(${angle.toFixed(4)}rad)` : "";
    style.opacity = o >= 1 ? "" : o.toFixed(3);
  }
}

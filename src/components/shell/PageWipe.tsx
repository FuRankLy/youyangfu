"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useTransition,
  type ComponentProps,
  type MouseEvent,
} from "react";
import { clamp, ease, prefersReducedMotion } from "@/lib/motion";
import { useScroll } from "./SmoothScroll";

// The page transition: squares sweep out from the click point until they cover
// the screen, the route changes underneath, then they clear from the same point.

const CELL = 40; // px, a multiple of the 8px lattice
const SPREAD = 220; // ms for the wave to reach the far corner
const GROW = 200; // ms for one square to grow or shrink
const MIN_HOLD = 60; // ms fully covered, so the swap never shows

type Phase = "idle" | "covering" | "covered" | "revealing";

type WipeApi = {
  /** Navigates to another route behind the square wipe. */
  go(href: string, origin?: { x: number; y: number }): void;
};

type WipeState = {
  phase: Phase;
  start: number;
  coveredAt: number;
  origin: { x: number; y: number };
  raf: number;
  navigated: boolean;
};

/** Draws one frame of the wipe. Returns false when the animation has finished. */
function paint(canvas: HTMLCanvasElement, s: WipeState, now: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#1b1e24";

  const { x: ox, y: oy } = s.origin;
  const far = Math.max(Math.hypot(ox, oy), Math.hypot(w - ox, oy), Math.hypot(ox, h - oy), Math.hypot(w - ox, h - oy));
  const elapsed = now - s.start;
  const cols = Math.ceil(w / CELL);
  const rows = Math.ceil(h / CELL);
  const revealing = s.phase === "revealing";

  if (s.phase === "covered") {
    ctx.fillRect(0, 0, w, h);
  } else {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = c * CELL + CELL / 2;
        const cy = r * CELL + CELL / 2;
        const delay = (Math.hypot(cx - ox, cy - oy) / far) * SPREAD;
        const p = ease.flight(clamp((elapsed - delay) / GROW));
        const scale = revealing ? 1 - p : p;
        if (scale <= 0.001) continue;
        // Slight overdraw at full size so neighbouring squares leave no seams.
        const size = CELL * scale + (scale >= 0.999 ? 1 : 0);
        ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
      }
    }
  }

  const total = SPREAD + GROW;
  if (s.phase === "covering" && elapsed >= total) {
    s.phase = "covered";
    s.coveredAt = now;
  } else if (s.phase === "revealing" && elapsed >= total) {
    s.phase = "idle";
    canvas.hidden = true;
    return false;
  }
  return true;
}


const WipeContext = createContext<WipeApi>({ go() {} });

export const usePageWipe = () => useContext(WipeContext);

export function PageWipeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useRef<WipeState>({
    phase: "idle",
    start: 0,
    coveredAt: 0,
    origin: { x: 0, y: 0 },
    raf: 0,
    navigated: false,
  });

  // Once the new route has rendered and the screen is fully covered, clear the squares.
  useEffect(() => {
    const s = state.current;
    if (s.phase === "idle" || !s.navigated || isPending) return;
    let raf = 0;
    const tryReveal = (now: number) => {
      if (s.phase === "covered" && now - s.coveredAt >= MIN_HOLD) {
        s.phase = "revealing";
        s.start = now;
        s.navigated = false;
        return;
      }
      if (s.phase === "covering" || s.phase === "covered") raf = requestAnimationFrame(tryReveal);
    };
    raf = requestAnimationFrame(tryReveal);
    return () => cancelAnimationFrame(raf);
  }, [pathname, isPending]);

  // The frame loop lives in a ref so the callbacks below can start it.
  const loop = useRef<(now: number) => void>(() => {});
  useEffect(() => {
    const s = state.current;
    const tick = (now: number) => {
      const canvas = canvasRef.current;
      if (canvas && paint(canvas, s, now)) s.raf = requestAnimationFrame(tick);
    };
    loop.current = tick;
    return () => cancelAnimationFrame(s.raf);
  }, []);

  const go = useCallback<WipeApi["go"]>(
    (href, origin) => {
      const s = state.current;
      const canvas = canvasRef.current;
      if (!canvas || prefersReducedMotion() || s.phase !== "idle") {
        router.push(href);
        return;
      }
      s.origin = origin ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      s.phase = "covering";
      s.start = performance.now();
      s.navigated = false;
      canvas.hidden = false;
      cancelAnimationFrame(s.raf);
      s.raf = requestAnimationFrame(loop.current);
      // Start the navigation once the wave has had time to cover the screen.
      window.setTimeout(() => {
        s.navigated = true;
        startTransition(() => router.push(href));
      }, SPREAD + GROW - 40);
    },
    [router],
  );

  const api = useMemo(() => ({ go }), [go]);

  return (
    <WipeContext.Provider value={api}>
      {children}
      <canvas ref={canvasRef} hidden aria-hidden="true" className="pointer-events-auto fixed inset-0 z-[90] h-full w-full" />
    </WipeContext.Provider>
  );
}

type TransitionLinkProps = ComponentProps<typeof Link>;

/**
 * A link that knows the site's two kinds of movement: a smooth scroll for
 * anchors on the current page, and the square wipe for a different route.
 */
export function TransitionLink({ href, onClick, onNavigate, children, ...rest }: TransitionLinkProps) {
  const pathname = usePathname();
  const wipe = usePageWipe();
  const { scrollTo } = useScroll();
  const point = useRef<{ x: number; y: number } | undefined>(undefined);

  // A file such as the CV is not a page: open it in a new tab, no wipe.
  if (typeof href === "string" && /.pdf($|[?#])/i.test(href)) {
    return (
      <a href={href} target="_blank" rel="noopener" onClick={onClick} {...rest}>
        {children}
        <span className="sr-only"> (PDF, opens in a new tab)</span>
      </a>
    );
  }

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // Keyboard activation reports 0,0; fall back to the link's own centre.
    if (event.clientX || event.clientY) {
      point.current = { x: event.clientX, y: event.clientY };
    } else {
      const box = event.currentTarget.getBoundingClientRect();
      point.current = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    }
    onClick?.(event);
  };

  return (
    <Link
      href={href}
      {...rest}
      onClick={handleClick}
      onNavigate={(event) => {
        onNavigate?.(event);
        if (typeof href !== "string") return;
        const [path, hash] = href.split("#");
        const samePage = path === "" || path === pathname;
        if (samePage && hash) {
          event.preventDefault();
          scrollTo(`#${hash}`);
          window.history.replaceState(null, "", `#${hash}`);
          return;
        }
        if (!samePage && !prefersReducedMotion()) {
          event.preventDefault();
          wipe.go(href, point.current);
        }
      }}
    >
      {children}
    </Link>
  );
}

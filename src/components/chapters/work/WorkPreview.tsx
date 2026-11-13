"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { clamp } from "@/lib/motion";
import { ProjectCover } from "./ProjectCover";

// The preview that follows the cursor over the work index. It wraps the list
// and listens for the pointer, so the rows themselves stay server-rendered.
// Decoration only: desktop with a mouse, and never with reduced motion.
//
// Across the page the panel trails the pointer, a little to one side of it.
// Down the page it settles just under the row being pointed at (or just over
// it, near the bottom of the window), so it never hides the row it describes.

/** Panel size in px: 38 by 26 cells of the 8px lattice. */
const W = 304;
const H = 208;
/** Space kept between the pointer and the panel, and the least it may shrink to while the panel catches up. */
const GAP = 24;
const MIN_GAP = 12;
/** Space kept between the panel and the row it belongs to. */
const ROW_GAP = 8;
/** Space kept between the panel and the edge of the window. */
const EDGE = 16;
/** Share of the remaining distance covered each frame. */
const LAG = 0.16;

const WHEN = "(hover: hover) and (pointer: fine) and (min-width: 64rem) and (prefers-reduced-motion: no-preference)";

type PreviewItem = { slug: string; cover?: string };

type Follow = {
  /** Where the panel is, and where it is heading (its top-left corner). */
  x: number;
  y: number;
  tx: number;
  ty: number;
  /** The pointer. */
  px: number;
  py: number;
  /** Which side of the pointer the panel sits on. */
  side: "right" | "left";
  /** The row under the pointer. */
  row: HTMLElement | null;
  raf: number;
  shown: boolean;
};

type WorkPreviewProps = {
  /** Every project in the list, with its cover image if it has one. */
  items: PreviewItem[];
  /** The list. Rows mark themselves with `data-slug`. */
  children: React.ReactNode;
};

export function WorkPreview({ items, children }: WorkPreviewProps) {
  // `run` counts appearances, so the same project assembles again when the panel comes back.
  const [current, setCurrent] = useState<{ slug: string; run: number } | null>(null);
  const [visible, setVisible] = useState(false);
  const panel = useRef<HTMLDivElement | null>(null);
  const follow = useRef<Follow>({ x: 0, y: 0, tx: 0, ty: 0, px: 0, py: 0, side: "right", row: null, raf: 0, shown: false });

  const place = useCallback(() => {
    const f = follow.current;
    if (panel.current) panel.current.style.transform = `translate3d(${Math.round(f.x)}px, ${Math.round(f.y)}px, 0)`;
  }, []);

  /** Works out where the panel should be heading. Read every frame, so it keeps up while the page scrolls. */
  const aim = useCallback(() => {
    const f = follow.current;
    if (!f.row) return;
    const vh = window.innerHeight;
    const box = f.row.getBoundingClientRect();
    const below = box.bottom + ROW_GAP;
    const above = box.top - ROW_GAP - H;
    f.tx = f.side === "right" ? f.px + GAP : f.px - GAP - W;
    if (below + H + EDGE <= vh) f.ty = below;
    else if (above >= EDGE) f.ty = above;
    else f.ty = clamp(f.py - H * 0.4, EDGE, Math.max(EDGE, vh - H - EDGE));
  }, []);

  const hide = useCallback(() => {
    const f = follow.current;
    if (!f.shown) return;
    f.shown = false;
    cancelAnimationFrame(f.raf);
    setVisible(false);
  }, []);

  // Turn the preview off if the window shrinks, the mouse is unplugged or motion is switched off.
  useEffect(() => {
    const query = window.matchMedia(WHEN);
    const onChange = () => {
      if (!query.matches) hide();
    };
    query.addEventListener("change", onChange);
    const f = follow.current;
    return () => {
      query.removeEventListener("change", onChange);
      cancelAnimationFrame(f.raf);
    };
  }, [hide]);

  const track = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || !window.matchMedia(WHEN).matches) return;
    const row = (event.target as Element).closest<HTMLElement>("[data-slug]");
    const slug = row?.dataset.slug;
    if (!row || !slug) {
      hide();
      return;
    }

    const f = follow.current;
    const vw = document.documentElement.clientWidth;
    const fitsRight = event.clientX + GAP + W + EDGE <= vw;
    const fitsLeft = event.clientX - GAP - W - EDGE >= 0;
    const appearing = !f.shown;
    // Stay on one side for as long as there is room, so the panel never crosses the pointer.
    let side = f.side;
    if (appearing) side = fitsRight ? "right" : "left";
    else if (side === "right" && !fitsRight) side = "left";
    else if (side === "left" && !fitsLeft) side = "right";
    const jumped = appearing || side !== f.side;

    f.px = event.clientX;
    f.py = event.clientY;
    f.side = side;
    f.row = row;
    aim();

    if (jumped) {
      f.x = f.tx;
      f.y = f.ty;
      place();
    }
    if (appearing) {
      f.shown = true;
      const tick = () => {
        aim();
        f.x += (f.tx - f.x) * LAG;
        f.y += (f.ty - f.y) * LAG;
        // Trailing behind is fine; sitting under the pointer is not.
        if (f.side === "right") f.x = Math.max(f.x, f.px + MIN_GAP);
        else f.x = Math.min(f.x, f.px - MIN_GAP - W);
        place();
        f.raf = requestAnimationFrame(tick);
      };
      f.raf = requestAnimationFrame(tick);
      setVisible(true);
    }
    setCurrent((was) => (was && was.slug === slug && !jumped ? was : { slug, run: (was?.run ?? 0) + 1 }));
  };

  // Puts the panel where it belongs the moment it exists, so it never flashes in a corner.
  const attach = useCallback(
    (node: HTMLDivElement | null) => {
      panel.current = node;
      place();
    },
    [place],
  );

  const cover = current ? items.find((item) => item.slug === current.slug)?.cover : undefined;

  return (
    <div onPointerMove={track} onPointerOver={track} onPointerLeave={hide}>
      {children}
      {current &&
        createPortal(
          <div
            ref={attach}
            aria-hidden="true"
            data-visible={visible}
            style={{ width: W, height: H }}
            className="pointer-events-none fixed left-0 top-0 z-30 rounded-[2px] border border-line bg-surface p-2 opacity-0 transition-opacity duration-[160ms] ease-settle will-change-transform data-[visible=true]:opacity-100 starting:opacity-0"
          >
            {cover ? (
              <span className="relative block h-full w-full overflow-hidden">
                <Image key={current.slug} src={cover} alt="" fill sizes={`${W}px`} className="object-cover" />
              </span>
            ) : (
              <ProjectCover key={`${current.slug}-${current.run}`} slug={current.slug} cols={24} rows={16} assemble />
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { Gear, GearSlot } from "@/content/types";
import { cn } from "@/lib/cn";
import { GearPixels } from "../GearPixels";
import { GEAR_ART } from "../gear-art";
import type { HologramScene } from "./hologram-scene";

export type StageCopy = {
  /** Names the stage for screen readers. */
  figure: string;
  /** How to use it, in the stage's corner. */
  hint: string;
  /** Read after the name: how the keyboard turns the figure. */
  keys: string;
  /** In the card while nothing is on show (phones). */
  prompt: string;
};

/** Stage width, in CSS pixels, from which the card floats beside the gear instead of sitting under the stage. */
const FLOAT_FROM = 440;
/** Gap between the floating card and the stage's edges. */
const MARGIN = 8;
/** One arrow-key press turns the figure by this much: 15°. */
const KEY_TURN = Math.PI / 12;

type Point = { x: number; y: number } | null;

const clamp = (value: number, lo: number, hi: number) => Math.min(Math.max(value, lo), Math.max(lo, hi));

/** The card's contents: the gear in pixels, what it is, and a line about it. */
function Intel({ item, compact }: { item: Gear; compact?: boolean }) {
  return (
    <div className={cn(compact ? "flex items-center gap-4" : "grid gap-3")}>
      <div className={cn("grid shrink-0 place-items-center", compact ? "h-28 w-28" : "h-44")}>
        <GearPixels key={item.slot} art={GEAR_ART[item.slot]} box={compact ? 112 : 176} />
      </div>
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-tiny text-ink-soft">
          <span aria-hidden="true" className="h-2 w-2 shrink-0 bg-cinnabar" />
          {item.label}
        </p>
        {item.name && <p className="mt-1 font-medium leading-snug">{item.name}</p>}
        {item.detail && <p className="mt-1 text-small text-ink-soft">{item.detail}</p>}
      </div>
    </div>
  );
}

/**
 * The hologram's stage. The three.js scene loads once the stage nears the
 * screen and draws only while it is on screen. On a wide stage the card for the
 * gear on show floats on the far side of the figure, joined to the gear by a
 * leader line; on a narrow one it sits under the stage.
 */
export function HologramStage({
  shown,
  item,
  facing,
  onHover,
  onPick,
  copy,
}: {
  shown: GearSlot | null;
  item: Gear | null;
  /** Changes each time the figure should turn to show a piece of gear. */
  facing: { slot: GearSlot; n: number } | null;
  onHover: (slot: GearSlot | null) => void;
  onPick: (slot: GearSlot | null) => void;
  copy: StageCopy;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<HologramScene | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<SVGLineElement>(null);
  const markRef = useRef<HTMLSpanElement>(null);
  /** The gear the floating card was last placed for. */
  const placedRef = useRef<GearSlot | null>(null);

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [wide, setWide] = useState(false);
  const [turned, setTurned] = useState(false);
  const floating = wide && ready && !failed;

  // Every frame a piece of gear is on show: move the mark onto it, place the card once, draw the line.
  const anchor = useEffectEvent((point: Point) => {
    const stage = stageRef.current;
    const mark = markRef.current;
    const line = lineRef.current;
    if (!stage || !mark || !line) return;
    if (!point) {
      delete mark.dataset.on;
      line.style.opacity = "0";
      return;
    }
    mark.style.transform = `translate(${point.x}px, ${point.y}px)`;
    mark.dataset.on = "";
    const card = cardRef.current;
    if (!floating || !card || !shown) {
      line.style.opacity = "0";
      return;
    }
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    if (placedRef.current !== shown) {
      // The card goes on the far side of the figure from the gear, level with it where it fits.
      const onLeft = point.x > width / 2;
      const top = clamp(point.y - card.offsetHeight / 2, MARGIN, height - card.offsetHeight - MARGIN);
      card.style.left = onLeft ? `${MARGIN}px` : `${width - card.offsetWidth - MARGIN}px`;
      card.style.top = `${top}px`;
      card.dataset.side = onLeft ? "left" : "right";
      card.dataset.placed = "";
      placedRef.current = shown;
    }
    const onLeft = card.dataset.side === "left";
    const endX = onLeft ? card.offsetLeft + card.offsetWidth : card.offsetLeft;
    const endY = clamp(point.y, card.offsetTop + 16, card.offsetTop + card.offsetHeight - 16);
    line.setAttribute("x1", `${point.x}`);
    line.setAttribute("y1", `${point.y}`);
    line.setAttribute("x2", `${endX}`);
    line.setAttribute("y2", `${endY}`);
    line.style.opacity = "1";
  });
  const hover = useEffectEvent((slot: GearSlot | null) => onHover(slot));
  const pick = useEffectEvent((slot: GearSlot | null) => onPick(slot));
  const firstTurn = useEffectEvent(() => setTurned(true));

  // Load the scene when the stage comes near, run it only while it is on screen.
  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;
    let disposed = false;
    let loading = false;
    let onScreen = false;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const start = async () => {
      loading = true;
      try {
        const { HologramScene } = await import("./hologram-scene");
        if (disposed) return;
        const scene = new HologramScene(
          canvas,
          { onHover: hover, onPick: pick, onAnchor: anchor, onTurned: firstTurn },
          motion.matches,
        );
        sceneRef.current = scene;
        scene.resize(stage.clientWidth, stage.clientHeight);
        scene.setVisible(onScreen);
        setReady(true);
      } catch {
        if (!disposed) setFailed(true);
      }
    };

    const near = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loading) void start();
      },
      { rootMargin: "600px 0px" },
    );
    const visible = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      sceneRef.current?.setVisible(onScreen && !document.hidden);
    });
    const resize = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setWide(width >= FLOAT_FROM);
      sceneRef.current?.resize(width, height);
    });
    const onMotion = () => sceneRef.current?.setReducedMotion(motion.matches);
    const onMode = () => sceneRef.current?.refreshColours();
    const onPageVisibility = () => sceneRef.current?.setVisible(onScreen && !document.hidden);

    near.observe(stage);
    visible.observe(stage);
    resize.observe(stage);
    motion.addEventListener("change", onMotion);
    window.addEventListener("modechange", onMode);
    document.addEventListener("visibilitychange", onPageVisibility);
    return () => {
      disposed = true;
      near.disconnect();
      visible.disconnect();
      resize.disconnect();
      motion.removeEventListener("change", onMotion);
      window.removeEventListener("modechange", onMode);
      document.removeEventListener("visibilitychange", onPageVisibility);
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    placedRef.current = null;
    sceneRef.current?.setShown(shown);
  }, [shown, ready, floating]);

  useEffect(() => {
    if (facing) sceneRef.current?.face(facing.slot);
  }, [facing]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    sceneRef.current?.turn(event.key === "ArrowLeft" ? -KEY_TURN : KEY_TURN);
  };

  return (
    <>
      <div
        ref={stageRef}
        tabIndex={ready ? 0 : -1}
        role="group"
        aria-label={`${copy.figure} ${copy.keys}`}
        onKeyDown={onKeyDown}
        className="relative h-[28rem] w-full select-none rounded-[2px] outline-offset-4 @[28rem]:h-[36rem]"
      >
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className={cn(
            "absolute inset-0 h-full w-full touch-pan-y cursor-grab data-[over]:cursor-pointer data-[turning]:cursor-grabbing",
            "transition-opacity duration-[600ms] ease-reveal",
            ready ? "opacity-100" : "opacity-0",
          )}
        />
        <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
          <line ref={lineRef} className="stroke-cinnabar" strokeWidth="1" style={{ opacity: 0 }} />
        </svg>
        <span
          ref={markRef}
          aria-hidden="true"
          className="pointer-events-none absolute left-[-3px] top-[-3px] h-1.5 w-1.5 bg-cinnabar opacity-0 data-[on]:opacity-100"
        />

        {floating && item && (
          <div
            ref={cardRef}
            key={item.slot}
            aria-hidden="true"
            className={cn(
              "absolute left-0 top-0 w-[13.5rem] rounded-[2px] border border-line bg-surface/90 p-4 backdrop-blur-sm",
              "opacity-0 data-[placed]:opacity-100",
              "motion-safe:scale-95 motion-safe:transition-[opacity,scale] motion-safe:duration-[320ms] motion-safe:ease-settle",
              "motion-safe:data-[placed]:scale-100 data-[side=left]:origin-right data-[side=right]:origin-left",
              "motion-reduce:transition-opacity motion-reduce:duration-150",
            )}
          >
            <Intel item={item} />
          </div>
        )}

        {ready && !(floating && item) && (
          <p
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute bottom-0 left-0 text-tiny text-ink-soft transition-opacity duration-[320ms] ease-settle",
              turned && "opacity-70",
            )}
          >
            {copy.hint}
          </p>
        )}
      </div>

      {/* Under the stage when it is narrow, or when the hologram can't run. */}
      {!floating && (
        <div aria-hidden="true" className="mt-4 min-h-[8rem] rounded-[2px] border border-line bg-surface p-4">
          {item ? <Intel item={item} compact /> : <p className="text-small text-ink-soft">{copy.prompt}</p>}
        </div>
      )}

      <p aria-live="polite" className="sr-only">
        {item ? [item.label, item.name, item.detail].filter(Boolean).join(". ") : ""}
      </p>
    </>
  );
}

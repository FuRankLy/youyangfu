"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { prefersReducedMotion } from "@/lib/motion";
import { GlyphScene, type Syllable } from "./glyph-scene";

type Props = {
  chars: readonly string[];
  pinyin?: readonly Syllable[];
  /** What the figure shows, for people who can't see it. */
  label: string;
  /** Sets the size of the drawing area, e.g. "h-[22rem]". */
  className?: string;
  /** Largest character box in pixels. */
  maxSize?: number;
};

/** Chinese characters written stroke by stroke in squares, then left at rest. */
export function WrittenGlyphs({ chars, pinyin, label, className, maxSize = 220 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scene = new GlyphScene(canvas, {
      chars,
      pinyin,
      fontFamily: getComputedStyle(document.body).fontFamily,
      centerY: 0.46,
      heightShare: 0.64,
      maxSize,
      reduced: prefersReducedMotion(),
    });

    const resizeObserver = new ResizeObserver(() => scene.resize());
    resizeObserver.observe(canvas);
    const intersection = new IntersectionObserver(([entry]) => scene.setVisible(entry.isIntersecting));
    intersection.observe(canvas);
    const onMode = () => scene.refreshColors();
    const onVisibility = () => {
      if (!document.hidden) scene.setVisible(true);
    };
    const onPointerMove = (event: PointerEvent) => {
      const box = canvas.getBoundingClientRect();
      scene.setPointer(event.clientX - box.left, event.clientY - box.top, event.pointerType === "mouse");
    };
    const onPointerLeave = () => scene.setPointer(-1e4, -1e4, false);

    window.addEventListener("modechange", onMode);
    document.addEventListener("visibilitychange", onVisibility);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);

    return () => {
      resizeObserver.disconnect();
      intersection.disconnect();
      window.removeEventListener("modechange", onMode);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      scene.destroy();
    };
  }, [chars, pinyin, maxSize]);

  return <canvas ref={canvasRef} role="img" aria-label={label} className={cn("block w-full", className)} />;
}

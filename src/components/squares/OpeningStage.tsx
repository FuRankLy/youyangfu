"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/motion";
import { GlyphScene, type Syllable } from "./glyph-scene";

type Props = {
  chars: readonly string[];
  pinyin: readonly Syllable[];
  latin: string;
  chinese: string;
  intro: string;
};

const SEEN_KEY = "opening-seen";
const DAY = 24 * 60 * 60 * 1000;
const SCROLL_KEYS = new Set(["ArrowDown", "PageDown", "End", " "]);

/**
 * The home page opening: the name written in squares, flying into its Latin
 * spelling, and the seal. The canvas does the drawing; real HTML carries the
 * heading, the controls and the text, so it all stays readable and reachable.
 */
export function OpeningStage({ chars, pinyin, latin, chinese, intro }: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nameRef = useRef<HTMLButtonElement>(null);
  const sceneRef = useRef<GlyphScene | null>(null);
  const pointerType = useRef("mouse");

  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    if (!section || !canvas) return;
    let cancelled = false;
    let onScreen = true;

    let seenRecently = false;
    try {
      seenRecently = Date.now() - Number(localStorage.getItem(SEEN_KEY) ?? 0) < DAY;
    } catch {}

    const describeName = () => {
      const scene = sceneRef.current;
      const button = nameRef.current;
      if (!scene || !button) return;
      const han = scene.showing === "han";
      button.setAttribute("aria-pressed", String(han));
      button.setAttribute("aria-label", han ? `Show my name as ${latin}` : `Show my name in Chinese, ${chinese}`);
    };

    const fontFamily = getComputedStyle(document.body).fontFamily;
    const fontsReady: Promise<unknown> = document.fonts?.load
      ? Promise.race([document.fonts.load(`600 100px ${fontFamily}`), new Promise((resolve) => setTimeout(resolve, 1200))])
      : Promise.resolve();

    fontsReady.then(() => {
      if (cancelled) return;
      sceneRef.current = new GlyphScene(canvas, {
        chars,
        pinyin,
        latin,
        seal: true,
        fontFamily,
        short: seenRecently,
        reduced: prefersReducedMotion(),
        onLayout(layout) {
          section.style.setProperty("--opening-text-top", `${layout.textTop}px`);
          section.style.setProperty("--han", layout.han.toFixed(3));
          const name = nameRef.current;
          if (name) {
            name.style.left = `${layout.name.x}px`;
            name.style.top = `${layout.name.y}px`;
            name.style.width = `${layout.name.w}px`;
            name.style.height = `${layout.name.h}px`;
          }
        },
        onIdle() {
          section.dataset.phase = "idle";
          if (nameRef.current) nameRef.current.disabled = false;
          describeName();
          try {
            localStorage.setItem(SEEN_KEY, String(Date.now()));
          } catch {}
        },
      });
      sceneRef.current.setVisible(onScreen);
      if (!sceneRef.current.idle) section.dataset.phase = "playing";
    });

    const resizeObserver = new ResizeObserver(() => sceneRef.current?.resize());
    resizeObserver.observe(canvas);
    const intersection = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      sceneRef.current?.setVisible(onScreen);
    });
    intersection.observe(section);

    const onMode = () => sceneRef.current?.refreshColors();
    const onVisibility = () => {
      if (!document.hidden) sceneRef.current?.setVisible(onScreen);
    };
    const skip = () => sceneRef.current?.skip();
    const onKey = (event: KeyboardEvent) => {
      if (SCROLL_KEYS.has(event.key)) skip();
    };
    const onPointerMove = (event: PointerEvent) => {
      const box = canvas.getBoundingClientRect();
      sceneRef.current?.setPointer(event.clientX - box.left, event.clientY - box.top, event.pointerType === "mouse");
    };
    const onPointerLeave = () => sceneRef.current?.setPointer(-1e4, -1e4, false);

    window.addEventListener("modechange", onMode);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("wheel", skip, { passive: true });
    window.addEventListener("touchmove", skip, { passive: true });
    window.addEventListener("keydown", onKey);
    section.addEventListener("pointermove", onPointerMove);
    section.addEventListener("pointerleave", onPointerLeave);
    section.addEventListener("click", skip);

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
      intersection.disconnect();
      window.removeEventListener("modechange", onMode);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("wheel", skip);
      window.removeEventListener("touchmove", skip);
      window.removeEventListener("keydown", onKey);
      section.removeEventListener("pointermove", onPointerMove);
      section.removeEventListener("pointerleave", onPointerLeave);
      section.removeEventListener("click", skip);
      sceneRef.current?.destroy();
      sceneRef.current = null;
    };
  }, [chars, pinyin, latin, chinese]);

  const syncNameLabel = () => {
    const scene = sceneRef.current;
    const button = nameRef.current;
    if (!scene || !button) return;
    const han = scene.showing === "han";
    button.setAttribute("aria-pressed", String(han));
    button.setAttribute("aria-label", han ? `Show my name as ${latin}` : `Show my name in Chinese, ${chinese}`);
  };

  return (
    <section
      ref={sectionRef}
      id="top"
      data-phase="loading"
      aria-label="Introduction"
      className="opening relative isolate h-svh max-h-[72rem] min-h-[34rem] overflow-clip"
    >
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 h-full w-full" />

      {/* The real heading. Visible without JavaScript; otherwise the canvas draws the name. */}
      <h1 className="opening-fallback pointer-events-none absolute inset-x-0 top-[47%] -translate-y-1/2 px-6 text-center text-display font-semibold">
        {latin}
        <span className="sr-only">
          , <span lang="zh-Hans">{chinese}</span>
        </span>
      </h1>

      <button
        ref={nameRef}
        type="button"
        disabled
        aria-pressed="false"
        aria-label={`Show my name in Chinese, ${chinese}`}
        className="absolute rounded-[2px] bg-transparent disabled:pointer-events-none"
        onPointerDown={(event) => {
          pointerType.current = event.pointerType;
        }}
        onPointerEnter={(event) => {
          if (event.pointerType !== "mouse") return;
          sceneRef.current?.show("han");
          syncNameLabel();
        }}
        onPointerLeave={(event) => {
          if (event.pointerType !== "mouse") return;
          sceneRef.current?.show("lat");
          syncNameLabel();
        }}
        onClick={(event) => {
          event.stopPropagation();
          // A mouse already switches on hover; taps and the keyboard toggle.
          if (event.detail !== 0 && pointerType.current === "mouse") return;
          sceneRef.current?.toggle();
          syncNameLabel();
        }}
      />

      <p
        className="opening-late absolute inset-x-0 mx-auto max-w-[34rem] px-6 text-center text-small text-ink-soft md:text-body"
        style={{ top: "var(--opening-text-top, 62%)" }}
      >
        {intro}
      </p>

      <p className="opening-late absolute inset-x-0 bottom-7 flex flex-col items-center gap-2 text-tiny text-ink-soft" aria-hidden="true">
        Scroll
        <span className="block h-6 w-px bg-line" />
      </p>
    </section>
  );
}

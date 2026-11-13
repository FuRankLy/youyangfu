"use client";

import { useEffect, useLayoutEffect, useSyncExternalStore } from "react";
import type { Mode } from "@/lib/mode-script";
import { cn } from "@/lib/cn";

const ORDER: Mode[] = ["now", "light", "dark"];
const NAMES: Record<Mode, string> = { now: "Now", light: "Light", dark: "Dark" };
const HINTS: Record<Mode, string> = {
  now: "Now: colours follow the sun over Auckland",
  light: "Light",
  dark: "Dark",
};

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function subscribe(onChange: () => void) {
  window.addEventListener("modechange", onChange);
  return () => window.removeEventListener("modechange", onChange);
}
const getMode = (): Mode => window.__mode?.get() ?? "now";
const getServerMode = (): Mode => "now";

/** Keeps React's idea of the mode in step with the inline mode script. */
function useMode() {
  const mode = useSyncExternalStore(subscribe, getMode, getServerMode);

  useIsoLayoutEffect(() => {
    // In development React resets <html> after the inline script ran; put it back.
    window.__mode?.refresh();
  }, []);

  // Now mode drifts with the sun, so re-apply it every minute.
  useEffect(() => {
    if (mode !== "now") return;
    const id = window.setInterval(() => window.__mode?.refresh(), 60_000);
    return () => window.clearInterval(id);
  }, [mode]);

  return [mode, (next: Mode) => window.__mode?.set(next)] as const;
}

/**
 * One small square that cycles Now, Light, Dark. The glyph is drawn by CSS from
 * the data-mode attribute on <html>, so it is right before React hydrates.
 */
export function ModeSwitch({ className }: { className?: string }) {
  const [mode, setMode] = useMode();
  const next = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];

  return (
    <button
      type="button"
      onClick={() => setMode(next)}
      className={cn("group grid h-10 w-10 place-items-center", className)}
      aria-label={`Colour mode: ${NAMES[mode]}. Switch to ${NAMES[next]}.`}
      title={HINTS[mode]}
    >
      <span
        aria-hidden="true"
        className="relative block h-4 w-4 overflow-hidden rounded-[1px] border-[1.5px] border-ink transition-transform duration-[160ms] ease-settle group-hover:scale-110"
      >
        {/* Dark: filled. Now: half filled on the diagonal. Light: empty. */}
        <span className="absolute inset-0 hidden bg-ink [[data-mode=dark]_&]:block" />
        <span className="absolute inset-0 hidden bg-ink [clip-path:polygon(100%_0,100%_100%,0_100%)] [[data-mode=now]_&]:block" />
      </span>
    </button>
  );
}

/** The same choice as three labelled buttons, for the phone menu. */
export function ModeChoice({ className }: { className?: string }) {
  const [mode, setMode] = useMode();
  return (
    <div role="group" aria-label="Colour mode" className={cn("inline-flex", className)}>
      {(["light", "dark", "now"] as Mode[]).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={mode === option}
          onClick={() => setMode(option)}
          className="-ml-px h-11 border border-line px-4 text-small font-medium first:ml-0 first:rounded-l-[2px] last:rounded-r-[2px] aria-pressed:relative aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-paper"
        >
          {NAMES[option]}
        </button>
      ))}
    </div>
  );
}

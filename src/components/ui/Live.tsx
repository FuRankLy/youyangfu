"use client";

import { useEffect, useRef } from "react";
import { lifeSplit } from "@/lib/life";
import { formatTime } from "@/lib/time";
import { cn } from "@/lib/cn";

// Live values. The server renders a quiet placeholder and the browser fills in
// the real value after hydration, so nothing here reads the clock while
// prerendering. Text is written straight to the DOM to avoid re-rendering React
// several times a second.

/** The current time in a city, e.g. "9:40 pm". Updates itself. */
export function LiveClock({ timeZone, className }: { timeZone: string; className?: string }) {
  const ref = useRef<HTMLTimeElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const tick = () => {
      const now = new Date();
      el.textContent = formatTime(now, timeZone);
      el.dateTime = now.toISOString();
    };
    tick();
    const id = window.setInterval(tick, 5000);
    return () => window.clearInterval(id);
  }, [timeZone]);

  return (
    <time ref={ref} className={cn("tnum", className)} suppressHydrationWarning>
      –:––
    </time>
  );
}

/**
 * Share of the owner's life spent in New Zealand, counting up live.
 * With reduced motion it shows two decimals and refreshes once a minute.
 */
export function LifePercent({ digits = 6, className }: { digits?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const places = calm ? Math.min(digits, 2) : digits;
    const tick = () => {
      el.textContent = lifeSplit(Date.now()).nzPercent.toFixed(places) + "%";
    };
    tick();
    const id = window.setInterval(tick, calm || places <= 2 ? 60_000 : 120);
    return () => window.clearInterval(id);
  }, [digits]);

  return (
    <span ref={ref} className={cn("tnum", className)} suppressHydrationWarning>
      {"50." + "0".repeat(Math.max(1, digits)) + "%"}
    </span>
  );
}

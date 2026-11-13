"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { localTimeLine } from "@/lib/time";

/**
 * One line with the current time in Auckland, so visitors know the time zone.
 * The server renders an empty line of the right height; the browser writes the
 * sentence after hydration and again as each minute begins, so nothing here
 * reads the clock while prerendering (same pattern as ui/Live.tsx).
 */
export function ReplyEstimate({ className }: { className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer = 0;
    const tick = () => {
      window.clearTimeout(timer);
      el.textContent = localTimeLine(new Date());
      // Wake just after the next minute starts, so the time shown is never a minute behind.
      timer = window.setTimeout(tick, 60_000 - (Date.now() % 60_000) + 200);
    };
    // Timers are throttled in background tabs, so catch up when the tab is looked at again.
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Room for one line, so the page doesn't move when the text arrives.
  return <p ref={ref} className={cn("min-h-[1.5em]", className)} suppressHydrationWarning />;
}

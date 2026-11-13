"use client";

import { useSyncExternalStore } from "react";

// One shared clock for the chapter's slow-moving facts (the time difference,
// the life split, the crossover line). The server and the first client render
// see `null`, so nothing reads the clock while prerendering and hydration
// always matches; the real time arrives straight after.

const TICK_MS = 30_000;

let current: number | null = null;
let timer: number | undefined;
const listeners = new Set<() => void>();

function refresh() {
  current = Date.now();
  for (const listener of listeners) listener();
}

function onVisible() {
  // Timers are throttled in background tabs; catch up when the tab returns.
  if (document.visibilityState === "visible") refresh();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (timer === undefined) {
    timer = window.setInterval(refresh, TICK_MS);
    document.addEventListener("visibilitychange", onVisible);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      timer = undefined;
      current = null;
    }
  };
}

const getSnapshot = () => (current ??= Date.now());
const getServerSnapshot = () => null;

/** The current time in milliseconds, refreshed twice a minute. `null` until the page has hydrated. */
export function useNow(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

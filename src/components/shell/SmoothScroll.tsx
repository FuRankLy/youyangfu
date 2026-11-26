"use client";

import Lenis from "lenis";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";

type ScrollApi = {
  /** Smoothly scrolls to an element or "#id", leaving room for the fixed header. */
  scrollTo(target: string | HTMLElement, options?: { immediate?: boolean }): void;
  /** Pauses and resumes page scrolling, for full-screen overlays. */
  lock(locked: boolean): void;
};

const ScrollContext = createContext<ScrollApi>({ scrollTo() {}, lock() {} });

export const useScroll = () => useContext(ScrollContext);

function headerOffset() {
  const value = getComputedStyle(document.documentElement).getPropertyValue("--header-h");
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  return (parseFloat(value) || 4) * rem + 16;
}

/**
 * Smooth wheel scrolling with Lenis. Touch scrolling stays native, and Lenis
 * turns itself off when the visitor prefers reduced motion.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const lenis = new Lenis({ autoRaf: true, lerp: 0.11, wheelMultiplier: 1 });
    lenisRef.current = lenis;
    return () => {
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  const scrollTo = useCallback<ScrollApi["scrollTo"]>((target, options) => {
    const el = typeof target === "string" ? document.querySelector<HTMLElement>(target) : target;
    if (!el) return;
    const lenis = lenisRef.current;
    if (lenis) {
      // Lenis already leaves the page's scroll-padding-top, which is the header's height plus a gap.
      lenis.scrollTo(el, { immediate: options?.immediate, duration: 1.1 });
    } else {
      const top = el.getBoundingClientRect().top + window.scrollY - headerOffset();
      window.scrollTo({ top, behavior: options?.immediate ? "auto" : "smooth" });
    }
  }, []);

  const lock = useCallback<ScrollApi["lock"]>((locked) => {
    const lenis = lenisRef.current;
    if (!lenis) return;
    if (locked) lenis.stop();
    else lenis.start();
  }, []);

  const api = useMemo(() => ({ scrollTo, lock }), [scrollTo, lock]);

  return <ScrollContext.Provider value={api}>{children}</ScrollContext.Provider>;
}

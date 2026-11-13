"use client";

import { useEffect, useRef, useState } from "react";
import { chipClass } from "@/components/ui/Button";
import { homes } from "@/content/homes";
import { site } from "@/content/site";
import { cn } from "@/lib/cn";
import { COLS, ROWS } from "./geo";
import { createHomesMap, type HomesMap as MapHandle } from "./map-controller";
import { useNow } from "@/lib/use-now";
import { formatGap, zoneGapHours } from "./zone-gap";

const { hometown, home } = site.places;
const copy = homes.map;
const distance = site.distanceKm.toLocaleString("en-NZ");

// Labels are real text laid over the canvas. The map controller finds them by
// `data-label`, measures them, and moves them with a transform. They never
// transition on their own (the reduced-motion rule in globals.css would
// otherwise slide them while the canvas snaps), so they stay on their marks.
const label = "absolute left-0 top-0 whitespace-nowrap will-change-transform transition-none";

/**
 * The map of the two homes, drawn as squares on a canvas with HTML labels on
 * top, plus the button that mirrors it across the equator.
 */
export function HomesMap({ className }: { className?: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<MapHandle | null>(null);
  const [flipped, setFlipped] = useState(false);

  // The time difference depends on the date (daylight saving), so it is worked
  // out in the browser. `now` is null on the server and during hydration.
  const now = useNow();
  const gap = now === null ? null : zoneGapHours(now, home.tz, hometown.tz);

  useEffect(() => {
    if (!boxRef.current || !canvasRef.current) return;
    const map = createHomesMap(boxRef.current, canvasRef.current);
    mapRef.current = map;
    return () => {
      map.destroy();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    mapRef.current?.setFlipped(flipped);
  }, [flipped]);

  const description = [
    copy.description,
    gap !== null && gap > 0 ? copy.clockSentence(gap) : null,
    flipped ? copy.flippedSentence : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <figure className={className}>
      <div
        ref={boxRef}
        role="img"
        aria-label={description}
        className="group @container relative"
        style={{
          aspectRatio: `${COLS} / ${ROWS}`,
          // Full column width, but never taller than the screen below the header.
          width: `min(100%, max(20rem, calc((100svh - var(--header-h) - 1.5rem) * ${COLS} / ${ROWS})))`,
        }}
      >
        <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 h-full w-full" />

        {/* Hidden until the controller has placed them, so nothing is seen out of position. */}
        <div className="absolute inset-0 opacity-0 group-data-[ready=true]:opacity-100">
          <p data-label="hometown" className={cn(label, "text-right")}>
            <span className="block text-tiny leading-tight font-medium @lg:text-small">
              <span className="han text-[1.15em]" lang="zh-Hans">
                {hometown.chinese}
              </span>{" "}
              {hometown.name}
            </span>
            <span className="tnum block text-tiny leading-tight text-ink-soft">{hometown.latLabel}</span>
          </p>

          <p data-label="home" className={label}>
            <span className="block text-tiny leading-tight font-medium @lg:text-small">{home.name}</span>
            <span className="tnum block text-tiny leading-tight text-ink-soft">{home.latLabel}</span>
          </p>

          <p data-label="flight" className={label}>
            <span className="tnum block text-small leading-tight font-semibold @lg:text-body">{distance} km</span>
            <span className="tnum block text-tiny leading-tight text-ink-soft">
              {copy.clock} {gap === null ? "+– h" : formatGap(gap)}
            </span>
          </p>

          <p data-label="equator" className={cn(label, "text-tiny leading-tight text-ink-soft")}>
            {copy.equator}
          </p>

          {/* Auckland's real latitude. The controller fades it in once the map is flipped. */}
          <p
            data-label="parallel"
            className={cn(label, "tnum invisible text-tiny leading-tight text-ink-soft opacity-0")}
          >
            {home.latLabel}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
        <button type="button" className={chipClass} aria-pressed={flipped} onClick={() => setFlipped((on) => !on)}>
          {copy.flip.button}
        </button>
        {/* Always laid out, so the page doesn't move when it appears. */}
        <p
          aria-hidden="true"
          className={cn(
            "min-w-0 flex-1 basis-64 text-small text-ink-soft transition-[opacity,visibility] duration-[320ms] ease-settle",
            flipped ? "visible opacity-100" : "invisible opacity-0",
          )}
        >
          {copy.flip.note}
        </p>
        <p role="status" className="sr-only">
          {flipped ? copy.flip.note : ""}
        </p>
      </div>
    </figure>
  );
}

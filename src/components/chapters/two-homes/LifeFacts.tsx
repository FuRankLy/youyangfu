"use client";

import { homes } from "@/content/homes";
import { site } from "@/content/site";
import { cn } from "@/lib/cn";
import { crossoverTime, lifeDates, lifeSplit } from "@/lib/life";
import { useNow } from "@/lib/use-now";

const { home } = site.places;

// Fixed facts, safe to work out anywhere: neither depends on today's date.
const hometownYears = lifeSplit(lifeDates.arrived).chinaYears.toFixed(1);
const crossover = crossoverTime();
const crossoverDate = new Intl.DateTimeFormat("en-NZ", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: home.tz,
}).format(crossover);

/**
 * The life split as one bar: Zhengzhou's years (fixed) and New Zealand's (still
 * growing). The server draws it half and half; the browser sets the real widths.
 */
export function LifeSplit({ className }: { className?: string }) {
  const now = useNow();
  const split = now === null ? null : lifeSplit(now);
  const hometownShare = split ? 100 - split.nzPercent : 50;

  return (
    <div className={className}>
      <div className="flex h-3" aria-hidden="true">
        <div className="bg-cinnabar" style={{ width: `${hometownShare}%` }} />
        <div className="flex-1 bg-ink" />
      </div>
      <div className="tnum mt-3 flex justify-between gap-6 text-small text-ink-soft">
        <p>
          {homes.split.years(hometownYears)}
        </p>
        <p className="text-right">
          {homes.split.yearsCounting(split ? split.nzYears.toFixed(1) : "–.–")}
        </p>
      </div>
    </div>
  );
}

/**
 * When time in New Zealand overtakes time in China. Whether that is still to
 * come depends on today's date, so the line is written in the browser; until
 * then it holds its space invisibly.
 */
export function CrossoverLine({ className }: { className?: string }) {
  const now = useNow();
  const lead = now !== null && now >= crossover ? homes.crossover.after : homes.crossover.before;
  return (
    <p className={cn(now === null && "invisible", className)} suppressHydrationWarning>
      {lead} {crossoverDate}
    </p>
  );
}

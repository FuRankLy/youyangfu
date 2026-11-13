// The life chart's numbers: one candle per month from birth to now.
//
// Real events shape the line (a `lift` steps it up, `shake` makes it move more
// for a while); everything else is a seeded random walk around a gently rising
// trend. Each month draws from its own seed, so a month's candle never changes
// as time passes or as later months are added. Pure functions: no clock here;
// the current month is passed in.

import type { LifeEvent, LifePeriod } from "@/content/types";
import { rng } from "@/lib/motion";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2024-03" as a count of months since year 0. */
export const monthIndex = (ym: string) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1;
const yearOf = (i: number) => Math.floor(i / 12);
const monthOf = (i: number) => i % 12;

/** "Mar 2024" */
export const shortMonth = (i: number) => `${MONTHS[monthOf(i)]} ${yearOf(i)}`;

/** "Mar 2024 to Nov 2024", "Mar 2024 to now", or "Mar 2024". */
export function monthRange(from: number, to: number | undefined, now: string) {
  if (to === undefined) return `${shortMonth(from)} to ${now}`;
  if (to === from) return shortMonth(from);
  return `${shortMonth(from)} to ${shortMonth(to)}`;
}

export type Bar = {
  /** First and last month covered, as month indexes. */
  start: number;
  end: number;
  open: number;
  high: number;
  low: number;
  close: number;
  /** The month still in progress. */
  forming: boolean;
};

const SEED = 270306;
const BASE = Math.log(10);
/** Trend per month, in log terms: roughly fourfold over twenty years. */
const DRIFT = 0.0056;
/** How strongly the line returns to its trend each month (1 = never). */
const PULL = 0.82;
const NOISE = 0.042;
/** Months over which an event's lift is taken up. */
const LIFT_MONTHS = 4;

/** A standard normal number from two uniform ones. */
function gaussian(next: () => number) {
  const u = Math.max(next(), 1e-9);
  const v = next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Monthly candles from `start` to `end` (both "YYYY-MM", inclusive).
 * `progress` (0 to 1) is how far through the last month we are; that candle
 * is drawn only that far.
 */
export function monthlyBars(start: string, end: string, events: LifeEvent[], progress = 1): Bar[] {
  const first = monthIndex(start);
  const last = monthIndex(end);
  const lifts = events.filter((e) => e.lift).map((e) => ({ at: monthIndex(e.from), size: e.lift ?? 0 }));
  const shakes = events.filter((e) => e.shake).map((e) => monthIndex(e.from));

  const bars: Bar[] = [];
  let deviation = 0;
  let previousClose = Math.exp(BASE - 0.03);

  for (let i = first; i <= last; i++) {
    const t = i - first;
    const next = rng(SEED + i * 7919);
    let lifted = 0;
    for (const lift of lifts) if (i >= lift.at) lifted += lift.size * Math.min(1, (i - lift.at + 1) / LIFT_MONTHS);
    let shake = 1;
    for (const at of shakes) if (i >= at) shake += 1.3 * Math.exp(-(i - at) / 5);

    deviation = PULL * deviation + NOISE * shake * gaussian(next);
    const level = BASE + DRIFT * t + lifted + deviation;
    const open = previousClose;
    let close = Math.exp(level);
    const wick = (0.006 + Math.abs(gaussian(next)) * 0.02) * shake;
    const tail = (0.006 + Math.abs(gaussian(next)) * 0.02) * shake;
    let high = Math.max(open, close) * Math.exp(wick);
    let low = Math.min(open, close) * Math.exp(-tail);

    const forming = i === last && progress < 1;
    if (forming) {
      // Only part of this month has happened: shrink the candle towards its open.
      const p = Math.max(0.04, progress);
      const fullClose = close;
      close = open + (fullClose - open) * p;
      high = Math.max(open, close) + (high - Math.max(open, fullClose)) * p;
      low = Math.min(open, close) - (Math.min(open, fullClose) - low) * p;
    }

    bars.push({ start: i, end: i, open, high, low, close, forming });
    previousClose = close;
  }
  return bars;
}

/**
 * Groups monthly candles into candles of `size` months (1, 2, 3, 6 or 12),
 * lined up with the calendar, the way a chart switches from monthly to
 * quarterly when there isn't room.
 */
export function groupBars(bars: Bar[], size: number): Bar[] {
  if (size <= 1) return bars;
  const out: Bar[] = [];
  for (const bar of bars) {
    const key = Math.floor(bar.start / size);
    const current = out[out.length - 1];
    if (current && Math.floor(current.start / size) === key) {
      current.end = bar.end;
      current.close = bar.close;
      current.high = Math.max(current.high, bar.high);
      current.low = Math.min(current.low, bar.low);
      current.forming = bar.forming;
    } else {
      out.push({ ...bar });
    }
  }
  return out;
}

/** "March 2024", "Jan to Mar 2024", "2019", or "Nov 2025 to Jan 2026". */
export function barLabel(bar: Bar) {
  if (bar.start === bar.end) return `${MONTHS_LONG[monthOf(bar.start)]} ${yearOf(bar.start)}`;
  if (yearOf(bar.start) === yearOf(bar.end)) {
    if (monthOf(bar.start) === 0 && monthOf(bar.end) === 11) return String(yearOf(bar.start));
    return `${MONTHS[monthOf(bar.start)]} to ${MONTHS[monthOf(bar.end)]} ${yearOf(bar.end)}`;
  }
  return `${shortMonth(bar.start)} to ${shortMonth(bar.end)}`;
}

/** Periods (places) that overlap a candle, in order. */
export function placesFor(bar: Bar, periods: LifePeriod[]) {
  return periods.filter((p) => monthIndex(p.from) <= bar.end && (p.to === undefined || monthIndex(p.to) >= bar.start));
}

/** Events that overlap a candle. Those that begin inside it come first. */
export function eventsFor(bar: Bar, events: LifeEvent[]) {
  const overlapping = events.filter((e) => {
    const from = monthIndex(e.from);
    const to = e.to ? monthIndex(e.to) : from;
    return from <= bar.end && to >= bar.start;
  });
  const starts = (e: LifeEvent) => monthIndex(e.from) >= bar.start;
  return [...overlapping.filter(starts), ...overlapping.filter((e) => !starts(e))].map((e) => ({
    event: e,
    begins: starts(e),
  }));
}

/** The current month in New Zealand as "YYYY-MM", and how far through it we are. */
export function currentMonth(now: number, timeZone = "Pacific/Auckland") {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(now));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { month: `${year}-${String(month).padStart(2, "0")}`, progress: day / days };
}

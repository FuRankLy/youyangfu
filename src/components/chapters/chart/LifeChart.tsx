"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { chipClass } from "@/components/ui/Button";
import type { LifeEvent, LifePeriod, Listing, Market } from "@/content/types";
import { cn } from "@/lib/cn";
import { clamp, ease, prefersReducedMotion } from "@/lib/motion";
import { useNow } from "@/lib/use-now";
import {
  barLabel,
  currentMonth,
  eventsFor,
  groupBars,
  monthIndex,
  monthlyBars,
  monthRange,
  placesFor,
  shortMonth,
  type Bar,
} from "./series";

export type ChartControlsCopy = {
  plotLabel: string;
  now: string;
  forming: string;
  market: string;
  hint: string;
  ranges: string;
  all: string;
};

type Props = {
  periods: LifePeriod[];
  events: LifeEvent[];
  listings: Record<Market, Listing>;
  copy: ChartControlsCopy;
};

/** What the plot shows: the month at its right edge (fractional, counted from birth) and how many months fit across. */
type View = { end: number; span: number };

const PAD_TOP = 40;
const PAD_BOTTOM = 12;
const LANE = 22;
const FLAG_GAP = 12;
const MIN_SPAN = 6;
/** The narrowest a candle may get before months are grouped into quarters, halves or years. */
const MIN_SLOT = 3.5;
const RANGES = [
  { label: "1Y", months: 12 },
  { label: "5Y", months: 60 },
  { label: "10Y", months: 120 },
] as const;

type Colors = { ink: string; soft: string; grid: string; paper: string; up: string; down: string };

function readColors(): Colors {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    ink: v("--ink", "#1b1e24"),
    soft: v("--ink-soft", "#5c636d"),
    grid: v("--grid", "#c3c8c8"),
    paper: v("--paper", "#edefec"),
    up: v("--jade", "#2b7a5f"),
    down: v("--cinnabar", "#c23b22"),
  };
}

let measurer: CanvasRenderingContext2D | null = null;
/** Width of a line of text in the site's small type, without touching the layout. */
function textWidth(text: string, weight = 500) {
  measurer ??= document.createElement("canvas").getContext("2d");
  if (!measurer) return text.length * 7;
  measurer.font = `${weight} 12px ${getComputedStyle(document.body).fontFamily}`;
  return measurer.measureText(text).width;
}

type FlagPlace = { id: string; label: string; when: string; at: number; x: number; lane: number; left: number; width: number };

/** True when two flags would touch: labels overlapping, or a stem running through a label. */
function clash(a: FlagPlace, b: FlagPlace) {
  const aRight = a.left + a.width;
  const bRight = b.left + b.width;
  if (a.lane === b.lane && a.left < bRight + FLAG_GAP && aRight > b.left - FLAG_GAP) return true;
  if (a.lane < b.lane && b.x > a.left - 6 && b.x < aRight + 6) return true;
  if (b.lane < a.lane && a.x > b.left - 6 && a.x < bRight + 6) return true;
  if (a.lane === b.lane && ((b.x > a.left - 6 && b.x < aRight + 6) || (a.x > b.left - 6 && a.x < bRight + 6))) return true;
  return false;
}

/** Rows under the axis for the flags in view: the fewest rows where no label touches another or crosses a stem. */
function placeFlags(events: LifeEvent[], toX: (month: number) => number, width: number): FlagPlace[] {
  const flags = events
    .filter((event) => event.flag)
    .map((event) => {
      const at = monthIndex(event.from);
      const when = shortMonth(at);
      return { id: event.id, label: event.flag ?? "", when, at, x: toX(at + 0.5), width: Math.ceil(textWidth(event.flag ?? "") + 5 + textWidth(when, 400)) + 2 };
    })
    .filter((f) => f.x >= 0 && f.x <= width);

  const options = (f: (typeof flags)[number], lanes: number) => {
    const out: FlagPlace[] = [];
    for (let lane = 0; lane < lanes; lane++) {
      for (const side of ["right", "left"] as const) {
        const left = side === "right" ? f.x + 10 : f.x - 10 - f.width;
        if (left < 0 || left + f.width > width) continue;
        out.push({ ...f, lane, left });
      }
    }
    return out;
  };

  for (let lanes = 1; lanes <= flags.length; lanes++) {
    const placed: FlagPlace[] = [];
    const search = (i: number): boolean => {
      if (i === flags.length) return true;
      for (const option of options(flags[i], lanes)) {
        if (placed.some((p) => clash(p, option))) continue;
        placed.push(option);
        if (search(i + 1)) return true;
        placed.pop();
      }
      return false;
    };
    if (search(0)) return placed;
  }
  return flags.map((f, lane) => ({ ...f, lane, left: Math.max(0, Math.min(f.x + 10, width - f.width)) }));
}

/** Labels that stick to the left edge while their stretch of time is in view, like a chart's legend. */
function stickyLabels<T>(items: { from: number; to: number; text: string; item: T }[], toX: (m: number) => number, width: number) {
  const out: { left: number; item: T }[] = [];
  items.forEach((entry, i) => {
    const x0 = toX(entry.from);
    const x1 = toX(entry.to);
    if (x1 <= 0 || x0 >= width) return;
    const left = Math.max(0, x0);
    const w = textWidth(entry.text) + 40;
    const isLast = i === items.length - 1;
    // A stretch about to scroll out gives way to the next one's label.
    if (!isLast && x1 - left < w) return;
    out.push({ left: Math.min(left, width - w + 30), item: entry.item });
  });
  return out;
}

/**
 * The life chart, built like a trading chart: one candle per month from birth
 * to now, which you can drag through and zoom. It needs the current month, so
 * it appears once the page runs in the browser; the List view carries the same
 * facts in the page from the start.
 */
export function LifeChart({ periods, events, listings, copy }: Props) {
  const now = useNow();
  const plotRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  // The candle picked by keyboard or tap; under a mouse, the candle under the cursor in the current view wins.
  const [active, setActive] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [colorTick, setColorTick] = useState(0);
  const [chosenView, setChosenView] = useState<View | null>(null);
  const [grabbing, setGrabbing] = useState(false);

  const current = now === null ? null : currentMonth(now);
  const today = current ? Math.round(current.progress * 31) : 0;
  const monthly = useMemo(
    () => (current ? monthlyBars(periods[0].from, current.month, events, today / 31) : []),
    // Recomputed when the month or the day changes, not on every tick of the clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current?.month, today, periods, events],
  );

  const first = monthIndex(periods[0].from);
  const total = monthly.length;
  const { width, height } = size;

  // Months before the first candle and after the last that the view may show.
  const lo = -2;
  const hi = total + 2;
  const fit = (v: View): View => {
    const span = clamp(v.span, MIN_SPAN, hi - lo);
    if (span >= hi - lo) return { span, end: hi };
    return { span, end: clamp(v.end, lo + span, hi) };
  };
  const defaultView = (): View => fit({ span: width < 640 ? 30 : Math.round(width / 15), end: total + 1 });
  const view = total && width ? fit(chosenView ?? defaultView()) : { end: 1, span: 1 };
  // Handlers read the latest view from here (it is updated after every render).
  const viewRef = useRef(view);
  useLayoutEffect(() => {
    viewRef.current = view;
  });
  const start = view.end - view.span;
  const toX = (month: number) => ((month - first - start) / view.span) * width;

  // Candles, grouped when months get too thin to draw.
  const grouping = useMemo(() => {
    const slot = width / view.span;
    return [1, 3, 6, 12].find((months) => slot * months >= MIN_SLOT) ?? 12;
  }, [width, view.span]);
  const allBars = useMemo(() => groupBars(monthly, grouping), [monthly, grouping]);
  const bars = useMemo(
    () => allBars.filter((b) => b.end - first >= start - 1 && b.start - first <= view.end + 1),
    [allBars, first, start, view.end],
  );

  // The price scale fits the candles in view, like a trading chart's auto-scale.
  const scale = useMemo(() => {
    if (!bars.length || !height) return null;
    const lowest = Math.log(Math.min(...bars.map((b) => b.low)));
    const highest = Math.log(Math.max(...bars.map((b) => b.high)));
    const range = highest - lowest || 0.1;
    return (value: number) => PAD_TOP + ((highest - Math.log(value)) / range) * (height - PAD_TOP - PAD_BOTTOM);
  }, [bars, height]);

  // Measure the plot; redraw when the colour mode changes.
  useEffect(() => {
    const plot = plotRef.current;
    if (!plot) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(plot);
    const onMode = () => setColorTick((n) => n + 1);
    window.addEventListener("modechange", onMode);
    return () => {
      observer.disconnect();
      window.removeEventListener("modechange", onMode);
    };
  }, []);

  // A tap anywhere else lets go of the chosen candle.
  useEffect(() => {
    const onDown = (event: globalThis.PointerEvent) => {
      if (event.pointerType !== "mouse" && !plotRef.current?.contains(event.target as Node)) setActive(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  /** Moves the view to `target`, gliding there unless motion is reduced. */
  const glide = useRef(0);
  const goTo = (target: View) => {
    cancelAnimationFrame(glide.current);
    const from = viewRef.current;
    const to = fit(target);
    if (prefersReducedMotion()) {
      setChosenView(to);
      return;
    }
    let t0 = -1;
    const step = (t: number) => {
      if (t0 < 0) t0 = t;
      const p = ease.settle(Math.min(1, (t - t0) / 420));
      setChosenView({ end: from.end + (to.end - from.end) * p, span: from.span + (to.span - from.span) * p });
      if (p < 1) glide.current = requestAnimationFrame(step);
    };
    glide.current = requestAnimationFrame(step);
  };
  useEffect(() => () => cancelAnimationFrame(glide.current), []);

  /** Zooms by `factor` (above 1 zooms out) keeping the month under `x` where it is. */
  const zoomAt = (x: number, factor: number) => {
    const v = viewRef.current;
    const anchor = v.end - v.span + (x / width) * v.span;
    const span = clamp(v.span * factor, MIN_SPAN, hi - lo);
    setChosenView(fit({ span, end: anchor + (1 - x / width) * span }));
  };
  const panBy = (months: number) => {
    const v = viewRef.current;
    setChosenView(fit({ span: v.span, end: v.end + months }));
  };

  // Wheel: Ctrl/⌘ (and trackpad pinch) zooms, sideways scrolling pans, plain scrolling still scrolls the page.
  useEffect(() => {
    const plot = plotRef.current;
    if (!plot) return;
    const onWheel = (event: WheelEvent) => {
      const box = plot.getBoundingClientRect();
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        event.stopPropagation();
        zoomAt(event.clientX - box.left, Math.exp(clamp(event.deltaY, -60, 60) * 0.01));
        return;
      }
      const sideways = Math.abs(event.deltaX) > Math.abs(event.deltaY) * 1.2 || event.shiftKey;
      if (!sideways) return;
      event.preventDefault();
      event.stopPropagation();
      const delta = event.deltaX || event.deltaY;
      panBy((delta / box.width) * viewRef.current.span);
    };
    plot.addEventListener("wheel", onWheel, { passive: false });
    return () => plot.removeEventListener("wheel", onWheel);
  });

  // Pointer: hover picks a candle, drag pans, two fingers pinch, a tap picks.
  const pointers = useRef(new Map<number, number>());
  const gesture = useRef<{ x: number; end: number; moved: boolean } | null>(null);
  const pinch = useRef<{ dist: number; span: number; mid: number } | null>(null);

  const barAt = (x: number) => {
    if (!bars.length) return null;
    let lo2 = 0;
    let hi2 = bars.length - 1;
    while (lo2 < hi2) {
      const mid = (lo2 + hi2) >> 1;
      if (toX(bars[mid].end + 1) < x) lo2 = mid + 1;
      else hi2 = mid;
    }
    return allBars.indexOf(bars[lo2]);
  };
  const localX = (clientX: number) => clientX - (plotRef.current?.getBoundingClientRect().left ?? 0);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const plot = plotRef.current;
    if (!plot) return;
    plot.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, localX(event.clientX));
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.abs(a - b) || 1, span: viewRef.current.span, mid: (a + b) / 2 };
      gesture.current = null;
    } else if (pointers.current.size === 1) {
      gesture.current = { x: localX(event.clientX), end: viewRef.current.end, moved: false };
    }
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const x = localX(event.clientX);
    if (pointers.current.has(event.pointerId)) pointers.current.set(event.pointerId, x);
    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.abs(a - b) || 1;
      const p = pinch.current;
      const span = clamp(p.span * (p.dist / dist), MIN_SPAN, hi - lo);
      const anchor = viewRef.current.end - viewRef.current.span + (p.mid / width) * viewRef.current.span;
      setChosenView(fit({ span, end: anchor + (1 - p.mid / width) * span }));
      return;
    }
    const g = gesture.current;
    if (g) {
      const dx = x - g.x;
      if (!g.moved && Math.abs(dx) > 5) {
        g.moved = true;
        setGrabbing(true);
      }
      if (g.moved) {
        setChosenView(fit({ span: viewRef.current.span, end: g.end - (dx / width) * viewRef.current.span }));
        if (event.pointerType === "mouse") setHoverX(x);
        return;
      }
    }
    if (event.pointerType === "mouse") setHoverX(x);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (g && !g.moved && event.pointerType !== "mouse") setActive(barAt(localX(event.clientX)));
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) {
      gesture.current = null;
      setGrabbing(false);
    }
  };

  const onPointerLeave = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && !gesture.current) setHoverX(null);
  };

  const hovered = hoverX !== null ? barAt(hoverX) : null;
  const chosen = hovered !== null && hovered >= 0 ? hovered : active !== null && active < allBars.length ? active : null;
  const bar: Bar | null = chosen !== null ? allBars[chosen] : null;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!allBars.length) return;
    const last = allBars.length - 1;
    const at = chosen ?? last;
    const perYear = Math.max(1, Math.round(12 / grouping));
    setHoverX(null);
    if (event.key === "Escape") {
      setActive(null);
      return;
    }
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoomAt(bar ? toX((bar.start + bar.end + 1) / 2) : width / 2, 0.8);
      return;
    }
    if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      zoomAt(bar ? toX((bar.start + bar.end + 1) / 2) : width / 2, 1.25);
      return;
    }
    if (event.key === "0") {
      event.preventDefault();
      goTo(defaultView());
      return;
    }
    const moves: Record<string, number> = { ArrowLeft: at - 1, ArrowRight: at + 1, PageUp: at - perYear, PageDown: at + perYear, Home: 0, End: last };
    if (!(event.key in moves)) return;
    event.preventDefault();
    const next = clamp(moves[event.key], 0, last);
    setActive(next);
    // Keep the chosen candle in view.
    const target = allBars[next];
    const v = viewRef.current;
    const s = target.start - first;
    const e = target.end - first + 1;
    if (s < v.end - v.span) goTo({ span: v.span, end: s + v.span - 1 });
    else if (e > v.end) goTo({ span: v.span, end: e + 1 });
  };

  // Draw.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !scale || !width || !height) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const c = readColors();
    const px = (v: number) => Math.round(v * dpr);
    const line = Math.max(1, Math.round(dpr));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Faint gridlines, no prices.
    ctx.fillStyle = c.grid;
    for (let i = 1; i <= 4; i++) ctx.fillRect(0, px(PAD_TOP + ((height - PAD_TOP - PAD_BOTTOM) * i) / 5), canvas.width, line);

    // Where each new place begins; the move to New Zealand is where the listing changes.
    periods.slice(1).forEach((period, i) => {
      const x = px(toX(monthIndex(period.from)));
      if (x < 0 || x > canvas.width) return;
      const moved = period.market !== periods[i].market;
      ctx.fillStyle = moved ? c.down : c.grid;
      const dash = moved ? 4 : 2;
      for (let y = 0; y < canvas.height; y += dash * 2 * dpr) ctx.fillRect(x, y, line, dash * dpr);
    });

    const flagged = new Set(events.filter((e) => e.flag).map((e) => monthIndex(e.from)));
    for (const b of bars) {
      const index = allBars.indexOf(b);
      const x0 = toX(b.start);
      const x1 = toX(b.end + 1);
      const body = Math.max(line, Math.round((x1 - x0) * 0.66 * dpr));
      const centre = px((x0 + x1) / 2);
      const up = b.close >= b.open;
      ctx.globalAlpha = chosen === null || chosen === index ? 1 : 0.3;
      ctx.fillStyle = up ? c.up : c.down;
      ctx.strokeStyle = up ? c.up : c.down;
      const top = px(scale(b.high));
      const bottom = px(scale(b.low));
      ctx.fillRect(centre - Math.floor(line / 2), top, line, Math.max(line, bottom - top));
      const bodyTop = px(scale(Math.max(b.open, b.close)));
      const bodyHeight = Math.max(line, px(scale(Math.min(b.open, b.close))) - bodyTop);
      const left = centre - Math.floor(body / 2);
      if (b.forming) {
        ctx.fillStyle = c.paper;
        ctx.fillRect(left, bodyTop, body, bodyHeight);
        ctx.setLineDash([2 * dpr, 2 * dpr]);
        ctx.lineWidth = line;
        ctx.strokeRect(left + line / 2, bodyTop + line / 2, Math.max(line, body - line), Math.max(line, bodyHeight - line));
        ctx.setLineDash([]);
      } else {
        ctx.fillRect(left, bodyTop, body, bodyHeight);
      }
      // A small mark over candles where something real happened.
      let marked = false;
      for (let m = b.start; m <= b.end && !marked; m++) marked = flagged.has(m);
      if (marked) {
        ctx.fillStyle = c.ink;
        const s = Math.round(4 * dpr);
        ctx.fillRect(centre - Math.floor(s / 2), top - px(9), s, s);
      }
    }
    ctx.globalAlpha = 1;

    if (bar) {
      const centre = px((toX(bar.start) + toX(bar.end + 1)) / 2);
      const y = px(scale(bar.close));
      ctx.fillStyle = c.soft;
      for (let yy = 0; yy < canvas.height; yy += 8 * dpr) ctx.fillRect(centre, yy, line, 4 * dpr);
      for (let xx = 0; xx < canvas.width; xx += 8 * dpr) ctx.fillRect(xx, y, 4 * dpr, line);
    }
    // toX is derived from the view and width, both listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars, allBars, scale, width, height, chosen, colorTick, periods, events, view.end, view.span]);

  // Keep the card beside its candle and inside the plot.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card || !bar || !scale) return;
    const centre = (toX(bar.start) + toX(bar.end + 1)) / 2;
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    const gap = 16;
    const right = centre + gap + w <= width;
    card.style.left = `${right ? centre + gap : Math.max(0, centre - gap - w)}px`;
    const mid = (scale(bar.high) + scale(bar.low)) / 2;
    card.style.top = `${Math.min(Math.max(8, mid - h / 2), height - h - 8)}px`;
    // toX is derived from the view and width, both listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bar, scale, width, height, view.end, view.span]);

  const ready = bars.length > 0 && scale !== null;
  const barVisible = bar !== null && toX(bar.end + 1) > 0 && toX(bar.start) < width;
  const barPlaces = bar ? placesFor(bar, periods) : [];
  const barEvents = bar ? eventsFor(bar, events) : [];
  const flags = ready ? placeFlags(events, toX, width) : [];
  const lanes = flags.reduce((max, f) => Math.max(max, f.lane + 1), 1);
  const endMonth = first + total;

  // Axis ticks: months when zoomed in, years further out.
  const ticks: { x: number; label?: string; major: boolean }[] = [];
  if (ready) {
    const startMonth = Math.floor(first + start);
    const finish = Math.ceil(first + view.end);
    const months = view.span <= 30;
    const yearStep = view.span <= 120 ? 1 : view.span <= 240 ? 2 : 5;
    for (let m = startMonth; m <= finish; m++) {
      const x = toX(m);
      if (x < 0 || x > width) continue;
      const year = Math.floor(m / 12);
      const monthOfYear = m % 12;
      if (months) {
        if (monthOfYear % 3 === 0) {
          // The first label in view carries its year, so a stretch without a January still says when it is.
          const firstLabel = !ticks.some((t) => t.label);
          const label = monthOfYear === 0 ? String(year) : firstLabel ? shortMonth(m) : shortMonth(m).slice(0, 3);
          ticks.push({ x, label, major: monthOfYear === 0 });
        }
        else ticks.push({ x, major: false });
      } else if (monthOfYear === 0) {
        ticks.push({ x, label: year % yearStep === 0 ? String(year) : undefined, major: year % yearStep === 0 });
      }
    }
  }

  const listingLabels = ready
    ? stickyLabels(
        periods
          .filter((p, i) => i === 0 || p.market !== periods[i - 1].market)
          .map((p, i, list) => ({
            from: monthIndex(p.from),
            to: i + 1 < list.length ? monthIndex(list[i + 1].from) : endMonth + 2,
            text: listings[p.market].name + listings[p.market].exchange,
            item: listings[p.market],
          })),
        toX,
        width,
      )
    : [];
  const placeLabels = ready
    ? stickyLabels(
        periods.map((p, i) => ({
          from: monthIndex(p.from),
          to: i + 1 < periods.length ? monthIndex(periods[i + 1].from) : endMonth + 2,
          text: p.place,
          item: p.place,
        })),
        toX,
        width,
      )
    : [];

  const rangeActive = (months: number | null) => {
    const target = fit(months === null ? { span: hi - lo, end: hi } : { span: months + 1, end: total + 1 });
    return Math.abs(target.span - view.span) < 0.5 && Math.abs(target.end - view.end) < 0.5;
  };

  const announce = bar
    ? [barLabel(bar), barPlaces.map((p) => p.place).join(", then "), ...barEvents.map(({ event }) => event.title), bar.forming ? copy.forming : ""]
        .filter(Boolean)
        .join(". ")
    : "";

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <p className="text-small text-ink-soft">{copy.hint}</p>
        <div role="group" aria-label={copy.ranges} className="flex gap-1">
          {[...RANGES, { label: copy.all, months: null }].map((range) => (
            <button
              key={range.label}
              type="button"
              aria-pressed={ready && rangeActive(range.months)}
              onClick={() => goTo(range.months === null ? { span: hi - lo, end: hi } : { span: range.months + 1, end: total + 1 })}
              className={cn(chipClass, "h-8 min-w-11 justify-center px-2.5 text-tiny")}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Listings, sticking to the left edge while their years are in view. */}
      <div className="relative h-7 overflow-hidden text-small">
        {listingLabels.map(({ left, item }) => (
          <p key={item.exchange} className="absolute top-0 flex items-baseline gap-2 whitespace-nowrap" style={{ left }} title={item.exchangeName}>
            <span className={cn("font-semibold", item.nameLang && "han")} lang={item.nameLang}>
              {item.name}
            </span>
            <span className="rounded-[2px] border border-line px-1.5 text-tiny text-ink-soft">{item.exchange}</span>
          </p>
        ))}
      </div>

      <div
        ref={plotRef}
        tabIndex={0}
        role="group"
        aria-roledescription="chart"
        aria-label={copy.plotLabel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerLeave}
        onDoubleClick={() => goTo(defaultView())}
        onKeyDown={onKeyDown}
        onFocus={() => setActive((a) => a ?? (allBars.length ? allBars.length - 1 : null))}
        onBlur={() => setActive(null)}
        className={cn(
          "relative mt-2 h-80 touch-pan-y select-none overflow-hidden border-b border-line outline-offset-4 md:h-[27.5rem]",
          grabbing ? "cursor-grabbing" : "cursor-grab",
        )}
      >
        <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 h-full w-full" />

        {placeLabels.map(({ left, item }) => (
          <span key={item} aria-hidden="true" className="absolute top-2 whitespace-nowrap text-tiny text-ink-soft" style={{ left: left + 8 }}>
            {item}
          </span>
        ))}

        {bar && barVisible && (
          <div
            ref={cardRef}
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 w-64 rounded-[2px] border border-line bg-surface p-3.5 text-small shadow-[0_1px_0_var(--grid)]"
          >
            <p className="font-semibold">{barLabel(bar)}</p>
            <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-tiny text-ink-soft">
              <span>{barPlaces.map((p) => p.place).join(", then ")}</span>
              {[...new Set(barPlaces.map((p) => p.market))].map((m) => (
                <span key={m} className="rounded-[2px] border border-line px-1">
                  {m}
                </span>
              ))}
            </p>
            {bar.forming && (
              <p className="mt-2 text-tiny">
                <span className="mr-1.5 inline-block h-1.5 w-1.5 translate-y-[-1px] bg-cinnabar" />
                {copy.forming}
              </p>
            )}
            {barEvents.length > 0 && (
              <ul className="mt-2.5 grid gap-2.5 border-t border-grid pt-2.5">
                {barEvents.map(({ event, begins }) => (
                  <li key={event.id} className={cn(!begins && "text-ink-soft")}>
                    <p className="font-medium leading-snug">{event.title}</p>
                    <p className="tnum text-tiny text-ink-soft">
                      {monthRange(monthIndex(event.from), event.to ? monthIndex(event.to) : monthIndex(event.from), copy.now)}
                    </p>
                    {begins && event.market && (
                      <p className="mt-1 text-tiny leading-snug text-ink-soft">
                        <span className="font-medium text-ink">{copy.market}</span> {event.market}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <p className="sr-only" aria-live="polite">
          {announce}
        </p>
      </div>

      {/* Flags: the real events in view, under the axis. */}
      <div className="relative overflow-hidden text-tiny" style={{ height: ready ? lanes * LANE + 6 : 72 }} aria-hidden="true">
        {flags.map((f) => {
          const lit = bar !== null && f.at >= bar.start && f.at <= bar.end;
          const markY = f.lane * LANE + 9;
          return (
            <span key={f.id}>
              <span className="absolute top-0 w-px bg-line" style={{ left: f.x, height: markY }} />
              <span className={cn("absolute h-1.5 w-1.5", lit ? "bg-cinnabar" : "bg-ink")} style={{ left: f.x - 2.5, top: markY - 3 }} />
              <span className="absolute whitespace-nowrap leading-none" style={{ left: f.left, top: f.lane * LANE + 4 }}>
                <span className={lit ? "font-semibold" : "font-medium"}>{f.label}</span> <span className="tnum text-ink-soft">{f.when}</span>
              </span>
            </span>
          );
        })}
      </div>

      {/* Time axis. */}
      <div className="relative mt-1 h-6 overflow-hidden border-t border-grid text-tiny text-ink-soft" aria-hidden="true">
        {ticks.map((tick, i) => (
          <span key={i} className="absolute top-0" style={{ left: tick.x }}>
            <span className={cn("absolute top-0 w-px bg-line", tick.major ? "h-2" : "h-1")} />
            {tick.label && <span className="tnum absolute left-1.5 top-1 whitespace-nowrap">{tick.label}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

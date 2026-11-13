"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { chipClass } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export type ChartView = "chart" | "list";

type ViewState = { view: ChartView; setView: (view: ChartView) => void };

const ViewContext = createContext<ViewState>({ view: "chart", setView() {} });

/** Holds which view is showing, so the switch in the heading and the panels below can share it. */
export function ChartViews({ children }: { children: React.ReactNode }) {
  const [view, setView] = useState<ChartView>("chart");
  const value = useMemo(() => ({ view, setView }), [view]);
  return <ViewContext.Provider value={value}>{children}</ViewContext.Provider>;
}

/** Two buttons: Chart, List. */
export function ViewSwitch({ label, names, className }: { label: string; names: Record<ChartView, string>; className?: string }) {
  const { view, setView } = useContext(ViewContext);
  return (
    <div role="group" aria-label={label} className={cn("inline-flex gap-1", className)}>
      {(["chart", "list"] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={view === option}
          onClick={() => setView(option)}
          className={cn(chipClass, "min-w-16 justify-center motion-reduce:transition-none")}
        >
          {names[option]}
        </button>
      ))}
    </div>
  );
}

/** One of the two views. Both are always in the markup; the one not chosen is `hidden`. */
export function ViewPanel({ view, children, className }: { view: ChartView; children: React.ReactNode; className?: string }) {
  const current = useContext(ViewContext).view;
  return (
    <div data-view={view} hidden={current !== view} className={className}>
      {children}
    </div>
  );
}

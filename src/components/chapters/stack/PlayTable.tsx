"use client";

import { useEffect, useId, useRef, useState } from "react";
import { buttonClass } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { StackPlay } from "./stack-play";

export type PlaqueData = {
  name: string;
  /** Year first used, when known. */
  since?: number;
};

export type TowerData = {
  area: string;
  /** "7 tools" */
  countLabel: string;
  /** Bottom first. */
  plaques: PlaqueData[];
};

type Copy = { hint: string; reset: string };

/** Fine marks inset at both ends, the detail that makes a rectangle read as a plaque. */
const EDGE_MARKS =
  "before:pointer-events-none before:absolute before:inset-y-0 before:left-[3px] before:w-px before:bg-grid md:before:left-[5px] " +
  "after:pointer-events-none after:absolute after:inset-y-0 after:right-[3px] after:w-px after:bg-grid md:after:right-[5px]";

/**
 * The region. Phones: a shelf across the top rows holds the first towers, the
 * rest stand on the floor, and a gap at the shelf's right end lets blocks fall
 * through. From md: every tower on the floor. Columns are never narrower than
 * their longest name.
 */
const REGION =
  "group/region relative grid h-[576px] gap-x-1.5 border border-grid border-b-line " +
  "grid-cols-[repeat(var(--upper),minmax(max-content,1fr))_minmax(40px,0.5fr)] grid-rows-[320px_32px_1fr] " +
  "md:h-[464px] md:grid-cols-[repeat(var(--count),minmax(max-content,1fr))] md:grid-rows-1 md:gap-x-4 md:px-2 lg:gap-x-6";

/**
 * Tools as plaques you can pick up. The blocks are laid out at home by CSS,
 * server-rendered; `StackPlay` adds gravity, dragging, throwing, the scroll
 * assembly and Reset, moving them only with transforms. The whole region is a
 * visual toy: screen readers get the list in `ToolList` instead.
 */
export function PlayTable({ towers, copy }: { towers: TowerData[]; copy: Copy }) {
  const regionRef = useRef<HTMLDivElement>(null);
  const playRef = useRef<StackPlay | null>(null);
  const [moved, setMoved] = useState(false);
  const hintId = useId();

  useEffect(() => {
    if (!regionRef.current) return;
    const play = new StackPlay(regionRef.current, setMoved);
    playRef.current = play;
    return () => {
      play.destroy();
      playRef.current = null;
    };
  }, []);

  const upper = Math.ceil(towers.length / 2);
  // Blocks land bottom row first, left to right.
  const order = towers
    .flatMap((tower, t) => tower.plaques.map((_, row) => ({ key: `${t}-${row}`, t, row })))
    .sort((a, b) => a.row - b.row || a.t - b.t)
    .map((b) => b.key);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-6 md:mb-8">
        <p id={hintId} className="text-small text-ink-soft">
          {copy.hint}
        </p>
        <button
          type="button"
          aria-disabled={!moved}
          aria-describedby={hintId}
          onClick={() => {
            if (moved) playRef.current?.reset();
          }}
          className={buttonClass(
            "outline",
            "shrink-0 aria-disabled:cursor-default aria-disabled:opacity-50 aria-disabled:hover:border-line aria-disabled:active:translate-y-0",
          )}
        >
          {copy.reset}
        </button>
      </div>

      {/* Floor labels hang below the region, so leave room for them. */}
      <div className="pb-10">
        <div
          ref={regionRef}
          aria-hidden="true"
          data-stack-region=""
          data-mode="scroll"
          className={REGION}
          style={{ "--upper": upper, "--count": towers.length } as React.CSSProperties}
        >
          {/* Phones: the shelf. A static body in the physics, with its towers' labels on its front edge. */}
          <div data-shelf="" className="col-[1/-2] row-start-2 border-y border-r border-grid border-t-line md:hidden" />

          {towers.map((tower, t) => {
            const onShelf = t < upper;
            return (
              <div
                key={tower.area}
                data-tower=""
                className={cn(
                  "relative flex flex-col-reverse self-end",
                  "[grid-column-start:var(--col-n)] [grid-row-start:var(--row-n)] md:[grid-column-start:var(--col-w)] md:row-start-1",
                )}
                style={
                  {
                    "--col-n": onShelf ? t + 1 : t - upper + 1,
                    "--row-n": onShelf ? 1 : 3,
                    "--col-w": t + 1,
                  } as React.CSSProperties
                }
              >
                {/* The label is drawn first so moving blocks pass over it. */}
                <p
                  className={cn(
                    "pointer-events-none absolute inset-x-0 top-full flex items-baseline gap-1.5 text-tiny md:justify-between md:gap-2 md:pt-3 md:text-small",
                    onShelf ? "max-md:h-8 max-md:items-center max-md:pt-px" : "pt-2.5",
                  )}
                >
                  <span className="font-medium">{tower.area}</span>
                  <span className="tnum text-ink-soft">
                    <span className="md:hidden">{tower.plaques.length}</span>
                    <span className="max-md:hidden">{tower.countLabel}</span>
                  </span>
                </p>

                {tower.plaques.map((plaque, row) => (
                  <div
                    key={plaque.name}
                    data-block={plaque.name}
                    data-rank={order.indexOf(`${t}-${row}`)}
                    className={cn(
                      "group/block relative z-[1] h-[34px] cursor-grab touch-none p-px [-webkit-touch-callout:none] md:h-[42px]",
                      "data-[held]:z-10 data-[held]:cursor-grabbing",
                      "group-data-[assembling]/region:pointer-events-none group-data-[holding]/region:select-none",
                    )}
                  >
                    <div
                      className={cn(
                        "relative flex h-full items-center justify-between gap-3 whitespace-nowrap rounded-[2px] border border-line bg-surface px-2 md:px-3 lg:px-4",
                        "text-tiny font-medium md:text-small",
                        "transition-[border-color,box-shadow] duration-[160ms] ease-settle hover:border-ink",
                        "group-data-[held]/block:border-ink group-data-[held]/block:shadow-[0_2px_0_var(--line),0_10px_22px_-12px_color-mix(in_oklab,var(--ink)_38%,transparent)]",
                        EDGE_MARKS,
                      )}
                    >
                      <span>{plaque.name}</span>
                      {plaque.since !== undefined && (
                        <span className="tnum text-tiny font-normal text-ink-soft">
                          {String(plaque.since % 100).padStart(2, "0")}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

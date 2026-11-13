import type { CSSProperties } from "react";
import { Chapter, DraftNote } from "@/components/ui/Chapter";
import { LifePercent } from "@/components/ui/Live";
import { homes } from "@/content/homes";
import { HomesMap } from "./two-homes/HomesMap";
import { CrossoverLine, LifeSplit } from "./two-homes/LifeFacts";

/**
 * Chapter one: the map of both homes on the left, the facts on the right.
 * This is the resting frame of the phase 2 scroll scene. The map's moving parts
 * live in ./two-homes (geo, map-renderer, map-controller) and take a scene
 * object, so the scene can drive them without changing this layout.
 */
export function TwoHomes() {
  return (
    <Chapter id="two-homes">
      <div className="grid-12 gap-y-14">
        <div data-assemble="left" className="col-span-12 lg:col-span-7">
          <HomesMap />
        </div>

        <div data-assemble-items className="col-span-12 flex flex-col gap-12 lg:col-span-5" style={{ "--ax": "2.5rem", "--ay": "0rem" } as CSSProperties}>
          <div className="grid gap-5">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
              {homes.facts.map((fact) => (
                <div key={fact.label}>
                  <dt className="font-medium">{fact.label}</dt>
                  <dd className="tnum text-ink-soft">{fact.when}</dd>
                </div>
              ))}
            </dl>
            <LifeSplit />
          </div>

          <div>
            <p>
              <LifePercent digits={6} className="block text-heading font-semibold" />
              <span className="mt-1 block">{homes.percentCaption}</span>
            </p>
            <CrossoverLine className="mt-3 text-small text-ink-soft" />
          </div>

          <div className="grid gap-4">
            <p className="measure">{homes.story}</p>
            {homes.placeholder && <DraftNote file="src/content/homes.ts" />}
          </div>
        </div>
      </div>
    </Chapter>
  );
}


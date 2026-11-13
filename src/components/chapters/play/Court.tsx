"use client";

import { useState } from "react";
import { chipClass } from "@/components/ui/Button";
import type { Gear, GearSlot } from "@/content/types";
import { cn } from "@/lib/cn";
import { GEAR_ORDER } from "./hologram/figure-3d";
import { HologramStage, type StageCopy } from "./hologram/HologramStage";
import { RoomFoot } from "./Room";

type CourtCopy = { stage: StageCopy; list: string };

/**
 * The Court: the player as a turning hologram built from cubes. Pointing at a
 * piece of gear, on the figure or in the row of chips beneath, makes it turn
 * solid and brings up its card. A press keeps it on show.
 */
export function Court({ gear, copy }: { gear: Gear[]; copy: CourtCopy }) {
  // Top to bottom, and only gear that is listed.
  const items = GEAR_ORDER.flatMap((slot) => gear.filter((entry) => entry.slot === slot));
  const listed = (slot: GearSlot | null) => (slot && items.some((entry) => entry.slot === slot) ? slot : null);

  const [hovered, setHovered] = useState<GearSlot | null>(null);
  const [selected, setSelected] = useState<GearSlot | null>(null);
  const [facing, setFacing] = useState<{ slot: GearSlot; n: number } | null>(null);
  const shown = hovered ?? selected;
  const item = items.find((entry) => entry.slot === shown) ?? null;

  const choose = (slot: GearSlot) => {
    const next = selected === slot ? null : slot;
    setSelected(next);
    if (next) setFacing((last) => ({ slot: next, n: (last?.n ?? 0) + 1 }));
  };

  return (
    <div className="flex flex-1 flex-col">
      <HologramStage
        shown={item?.slot ?? null}
        item={item}
        facing={facing}
        onHover={(slot) => setHovered(listed(slot))}
        onPick={(slot) => setSelected(listed(slot))}
        copy={copy.stage}
      />

      <RoomFoot className="mt-auto">
        <div role="group" aria-label={copy.list} className="flex flex-wrap gap-2">
          {items.map((entry) => (
            <button
              key={entry.slot}
              type="button"
              aria-pressed={selected === entry.slot}
              onClick={() => choose(entry.slot)}
              onPointerEnter={(event) => event.pointerType === "mouse" && setHovered(entry.slot)}
              onPointerLeave={() => setHovered(null)}
              className={cn(chipClass, "h-9 px-3 text-tiny")}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </RoomFoot>
    </div>
  );
}

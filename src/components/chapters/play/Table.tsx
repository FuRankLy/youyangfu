"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { Hand } from "@/content/types";
import { cn } from "@/lib/cn";
import { CARD_BOX, CardBack, CardFace, parseCard, type PlayingCard } from "./cards";
import { ROOM_CARD, RoomFoot } from "./Room";

type TableCopy = {
  hand: string;
  board: string;
  hint: string;
  turnAll: string;
  reset: string;
  undealt: string;
};

/**
 * A control with nothing to do right now. It stays focusable (aria-disabled,
 * not disabled), so pressing it never drops the keyboard focus.
 */
const UNAVAILABLE = "aria-disabled:cursor-default aria-disabled:opacity-50 aria-disabled:hover:border-line aria-disabled:active:translate-y-0";

/** One card on the board: flips over when its street is dealt. */
function BoardCard({ card, turned, delay }: { card: PlayingCard; turned: boolean; delay: number }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute inset-0 motion-safe:transition-transform motion-safe:duration-[320ms] motion-safe:ease-settle motion-safe:transform-3d",
        turned && "motion-safe:rotate-y-180",
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <span className={cn("absolute inset-0 motion-safe:backface-hidden", turned && "motion-reduce:hidden")}>
        <CardBack />
      </span>
      <span
        className={cn(
          "absolute inset-0 motion-safe:rotate-y-180 motion-safe:backface-hidden",
          // Face down, the face is truly hidden once the flip back has finished.
          !turned && "motion-reduce:hidden motion-safe:invisible motion-safe:[transition:visibility_0s_linear_800ms]",
        )}
      >
        <CardFace card={card} size="board" />
      </span>
    </span>
  );
}

/**
 * The Table: my hand, face up, and the board dealt a street at a time. Each
 * street carries a short line. The river stays face down: it isn't dealt yet.
 */
export function Table({ hand, copy }: { hand: Hand; copy: TableCopy }) {
  const hole = hand.hole.map(parseCard);
  const streets = hand.streets.map((street) => ({ ...street, cards: street.cards.map(parseCard) }));
  const dealable = streets.map((street, i) => (street.cards.length > 0 ? i : -1)).filter((i) => i >= 0);

  const [dealt, setDealt] = useState<boolean[]>(() => streets.map(() => false));
  /** The street whose line is showing; -1 shows the hand's own line. */
  const [shown, setShown] = useState<number | null>(null);
  /** True after "Deal the board", so the cards go over one after another. */
  const [dealing, setDealing] = useState(false);

  const allDealt = dealable.every((i) => dealt[i]);
  const anyDealt = dealable.some((i) => dealt[i]);

  const deal = (index: number) => {
    setDealing(false);
    setDealt((streetsDealt) => streetsDealt.map((isDealt, i) => isDealt || i === index));
    setShown(index);
  };
  const dealAll = () => {
    if (allDealt) return;
    setDealing(true);
    setDealt(streets.map((street) => street.cards.length > 0));
    setShown(dealable[dealable.length - 1] ?? null);
  };
  const reset = () => {
    if (!anyDealt) return;
    setDealing(false);
    setDealt(streets.map(() => false));
    setShown(null);
  };

  const line = shown === null ? null : shown < 0 ? { name: copy.hand, note: hand.holeNote } : streets[shown];
  let order = 0;

  return (
    <div className="flex flex-1 flex-col">
      <p className="text-small text-ink-soft">{copy.hand}</p>
      <button
        type="button"
        onClick={() => setShown(-1)}
        aria-label={`${copy.hand}: ${hole.map((card) => card.name).join(" and ")}. ${hand.holeNote}`}
        className="mt-3 flex w-max gap-2 rounded-[2px]"
      >
        {hole.map((card, i) => (
          <span key={i} className={cn("block", CARD_BOX.hole)}>
            <CardFace card={card} size="hole" />
          </span>
        ))}
      </button>

      <div role="group" aria-label={copy.board} className="mt-10 flex gap-3">
        {streets.map((street, s) => {
          const undealt = street.cards.length === 0;
          const isDealt = dealt[s];
          return (
            <div key={street.name}>
              {undealt ? (
                // The river: one face-down card. Pressing it shows its line; it never turns over.
                <button
                  type="button"
                  onClick={() => setShown(s)}
                  aria-label={`${street.name}, ${copy.undealt}. ${street.note}`}
                  className={cn("relative block rounded-[2px] opacity-70 transition-opacity duration-[160ms] hover:opacity-100", CARD_BOX.board)}
                >
                  <CardBack />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => deal(s)}
                  aria-label={
                    isDealt
                      ? `${street.name}: ${street.cards.map((card) => card.name).join(", ")}. ${street.note}`
                      : `${street.name}, face down. Deal it.`
                  }
                  className="flex gap-1 rounded-[2px]"
                >
                  {street.cards.map((card, i) => (
                    <span key={i} className={cn("relative block perspective-[40rem]", CARD_BOX.board)}>
                      <BoardCard card={card} turned={isDealt} delay={dealing ? order++ * 70 : i * 60} />
                    </span>
                  ))}
                </button>
              )}
              <p className="mt-3 flex items-center gap-1.5 text-tiny text-ink-soft">
                {shown === s && <span aria-hidden="true" className="h-1 w-1 bg-cinnabar" />}
                {street.name}
              </p>
            </div>
          );
        })}
      </div>

      {/* Pinned to the bottom of the room, level with the Court's card. */}
      <div className="mt-auto pt-8">
        <div aria-live="polite" className={ROOM_CARD}>
          {line ? (
            <>
              <p className="text-tiny text-ink-soft">{line.name}</p>
              <p className="mt-2 font-medium leading-snug">{line.note}</p>
            </>
          ) : (
            <>
              <p className="text-tiny text-ink-soft">{copy.hand}</p>
              <p className="mt-2 font-medium leading-snug">{hand.holeNote}</p>
              <p className="mt-2 text-small text-ink-soft">{copy.hint}</p>
            </>
          )}
        </div>

        <RoomFoot className="gap-3">
          <Button variant="outline" aria-disabled={allDealt || undefined} onClick={dealAll} className={UNAVAILABLE}>
            {copy.turnAll}
          </Button>
          <Button variant="outline" aria-disabled={!anyDealt || undefined} onClick={reset} className={UNAVAILABLE}>
            {copy.reset}
          </Button>
        </RoomFoot>
      </div>
    </div>
  );
}

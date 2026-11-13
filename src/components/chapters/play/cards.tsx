import { cn } from "@/lib/cn";

// Playing cards for the Table: reading "K♠" into a rank and suit, and drawing
// the two sides of a card. Sizes are whole lattice cells at the true 5:7 shape.

export type Suit = "spades" | "hearts" | "diamonds" | "clubs";

export type PlayingCard = {
  /** As printed on the card: "A", "K", "10", "9". */
  rank: string;
  suit: Suit;
  /** Spoken name, e.g. "King of spades". */
  name: string;
};

const SUITS: Record<string, Suit> = { "♠": "spades", "♥": "hearts", "♦": "diamonds", "♣": "clubs" };

const RANK_NAMES: Record<string, string> = {
  A: "Ace",
  K: "King",
  Q: "Queen",
  J: "Jack",
  "10": "Ten",
  "9": "Nine",
  "8": "Eight",
  "7": "Seven",
  "6": "Six",
  "5": "Five",
  "4": "Four",
  "3": "Three",
  "2": "Two",
};

/** Reads a card written as rank then suit symbol, e.g. "K♠" or "10♦". */
export function parseCard(card: string): PlayingCard {
  const symbol = card.trim().slice(-1);
  const rank = card.trim().slice(0, -1).toUpperCase();
  const suit = SUITS[symbol];
  if (!suit || !RANK_NAMES[rank]) throw new Error(`Not a playing card: "${card}"`);
  return { rank, suit, name: `${RANK_NAMES[rank]} of ${suit}` };
}

export const isRed = (suit: Suit) => suit === "hearts" || suit === "diamonds";

/** A suit symbol drawn as a shape, so it looks the same on every device. Takes the text colour. */
export function SuitMark({ suit, className }: { suit: Suit; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn("fill-current", className)} aria-hidden="true" focusable="false">
      {suit === "hearts" && (
        <path d="M8 14.2C3.6 10.8 1.5 8.3 1.5 5.7 1.5 3.6 3.1 2 5 2c1.2 0 2.3.6 3 1.7C8.7 2.6 9.8 2 11 2c1.9 0 3.5 1.6 3.5 3.7 0 2.6-2.1 5.1-6.5 8.5Z" />
      )}
      {suit === "diamonds" && <path d="M8 1.2 13.6 8 8 14.8 2.4 8Z" />}
      {suit === "spades" && (
        <path d="M8 1.4C5.6 4.6 1.8 6.7 1.8 9.8c0 1.8 1.3 3 2.9 3 1.1 0 2-.5 2.6-1.4-.1 1.3-.6 2.3-1.5 3.2h4.4c-.9-.9-1.4-1.9-1.5-3.2.6.9 1.5 1.4 2.6 1.4 1.6 0 2.9-1.2 2.9-3 0-3.1-3.8-5.2-6.2-8.4Z" />
      )}
      {suit === "clubs" && (
        <>
          <circle cx="8" cy="4.5" r="3" />
          <circle cx="4.5" cy="9.3" r="3" />
          <circle cx="11.5" cy="9.3" r="3" />
          <path d="M6.6 6.8h2.8v3H6.6zM7.3 9.2c.1 2.5-.4 4.1-1.5 5.4h4.4c-1.1-1.3-1.6-2.9-1.5-5.4Z" />
        </>
      )}
    </svg>
  );
}

/**
 * "board" cards are 48 by 68 px (6 cells wide, so a fingertip target on the
 * narrowest phones), growing to 7 by 10 cells when the room has the width.
 * "hole" cards are 10 by 14 cells.
 */
export type CardSize = "board" | "hole";

export const CARD_BOX: Record<CardSize, string> = {
  board: "h-17 w-12 @[20rem]:h-20 @[20rem]:w-14",
  hole: "h-28 w-20",
};

/** The face: rank in semibold with the suit beneath. Hearts and diamonds in cinnabar. */
export function CardFace({ card, size }: { card: PlayingCard; size: CardSize }) {
  return (
    <span
      className={cn(
        "flex h-full w-full flex-col items-center justify-center rounded-[2px] border border-ink bg-surface",
        size === "board" ? "gap-1 @[20rem]:gap-1.5" : "gap-2",
        isRed(card.suit) ? "text-cinnabar" : "text-ink",
      )}
    >
      <span
        className={cn(
          "tnum font-semibold leading-none",
          size === "board" ? "text-body leading-none @[20rem]:text-lead @[20rem]:leading-none" : "text-heading leading-none",
        )}
      >
        {card.rank}
      </span>
      <SuitMark suit={card.suit} className={size === "board" ? "h-3 w-3 @[20rem]:h-4 @[20rem]:w-4" : "h-6 w-6"} />
    </span>
  );
}

/**
 * The back: a tight lattice of 2px squares, 2px apart, inside a 4px margin.
 * Ink shows through a grid of surface-coloured gaps. Every card size leaves a
 * whole number of squares, so the lattice ends on a square on all four sides.
 */
export function CardBack() {
  return (
    <span className="block h-full w-full rounded-[2px] border border-ink bg-surface p-1">
      <span
        className="block h-full w-full bg-ink"
        style={{
          backgroundImage:
            "linear-gradient(to right, transparent 2px, var(--surface) 2px), linear-gradient(to bottom, transparent 2px, var(--surface) 2px)",
          backgroundSize: "4px 4px",
        }}
      />
    </span>
  );
}

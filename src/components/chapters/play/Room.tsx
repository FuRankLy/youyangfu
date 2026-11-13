import type { Room as RoomMeta } from "@/content/types";
import { cn } from "@/lib/cn";

/**
 * The frame the three rooms share: a bordered panel with the room's name in
 * both scripts. What goes inside is each room's own business. The panel is a
 * size container, so a room can lay itself out by the width it actually gets.
 */
export function Room({ room, children, className }: { room: RoomMeta; children: React.ReactNode; className?: string }) {
  const headingId = `room-${room.id}`;
  return (
    <section
      aria-labelledby={headingId}
      className={cn("@container flex flex-col rounded-[2px] border border-line p-5 sm:p-6 xl:p-8", className)}
    >
      <h3 id={headingId} className="flex items-baseline gap-3 text-subhead font-semibold">
        {room.title}
        <span className="han text-ink-soft" lang="zh-Hans">
          {room.chinese}
        </span>
      </h3>
      <div className="mt-6 flex flex-1 flex-col">{children}</div>
    </section>
  );
}

// Side by side, the rooms stretch to the tallest (the Court) and share three
// bands: the stage at the top, a card beneath it, and a foot one button high.
// Each room pins its card and foot to the bottom, so the cards start on one
// line and the rooms end on another, whatever the stage above holds.

/**
 * The card beneath a room's stage. The same minimum height in every room keeps
 * the cards' top edges level; 8rem holds a label and three lines of text.
 */
export const ROOM_CARD = "min-h-[8rem] rounded-[2px] border border-line bg-surface p-4";

/** A card that also fills the foot band, for a room whose last word lives inside its card. */
export const ROOM_CARD_TALL = "min-h-[calc(8rem+1.5rem+2.75rem)] rounded-[2px] border border-line bg-surface p-4";

/** The last line of a room: a note or the room's controls, one button high so every room ends on the same line. */
export function RoomFoot({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex min-h-11 flex-wrap items-center gap-2 pt-6 box-content", className)}>{children}</div>;
}

/** The quiet last line of a room, saying what arrives in a later phase. */
export function RoomNote({ children }: { children: React.ReactNode }) {
  return (
    <RoomFoot>
      <p className="text-small text-ink-soft">{children}</p>
    </RoomFoot>
  );
}

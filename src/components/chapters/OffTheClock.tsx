import { Chapter, DraftNote } from "@/components/ui/Chapter";
import { cn } from "@/lib/cn";
import { arcadeCopy, courtCopy, games, gear, hand, playIsPlaceholder, rooms, tableCopy } from "@/content/play";
import { Arcade } from "./play/Arcade";
import { Court } from "./play/Court";
import { Room } from "./play/Room";
import { Table } from "./play/Table";

// The rooms side by side, stacked on phones. A room shows only once it has
// real content: the Arcade returns when there are games to list.
export function OffTheClock() {
  return (
    <Chapter id="play">
      <div data-assemble-items className={cn("grid gap-6", games.length > 0 ? "lg:grid-cols-3" : "lg:grid-cols-[7fr_5fr]")}>
        <Room room={rooms.court}>
          <Court gear={gear} copy={courtCopy} />
        </Room>
        <Room room={rooms.table}>
          <Table hand={hand} copy={tableCopy} />
        </Room>
        {games.length > 0 && (
          <Room room={rooms.arcade}>
            <Arcade games={games} copy={arcadeCopy} />
          </Room>
        )}
      </div>
      {playIsPlaceholder && <DraftNote file="src/content/play.ts" className="mt-8" />}
    </Chapter>
  );
}

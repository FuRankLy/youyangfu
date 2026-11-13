import type { Game } from "@/content/types";
import { rng } from "@/lib/motion";
import { cn } from "@/lib/cn";
import { ROOM_CARD_TALL } from "./Room";

type ArcadeCopy = { list: string; empty: string; rank: string; main: string; hoursUnit: string; hoursLabel: string; rally: string };

const CELL = 8;
const SIDE = 8;

/**
 * A game's thumbnail: a small mirrored pattern of squares on the lattice, the
 * same for the same title every time. Unlit cells show as faint dots, so it
 * reads as a tiny screen. Stands in until real cover art arrives.
 */
function Thumbnail({ title }: { title: string }) {
  let seed = 0;
  for (const char of title) seed = (Math.imul(seed, 31) + char.charCodeAt(0)) | 0;
  const random = rng(seed);
  const half = SIDE / 2;
  const lit: boolean[][] = Array.from({ length: SIDE }, () => {
    const left = Array.from({ length: half }, () => random() < 0.5);
    return [...left, ...left.slice().reverse()];
  });

  return (
    <svg
      width={SIDE * CELL}
      height={SIDE * CELL}
      viewBox={`0 0 ${SIDE * CELL} ${SIDE * CELL}`}
      className="shrink-0"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      {lit.flatMap((line, row) =>
        line.map((on, col) =>
          on ? (
            <rect key={`${col}-${row}`} x={col * CELL + 1} y={row * CELL + 1} width="6" height="6" className="fill-ink" />
          ) : (
            <rect key={`${col}-${row}`} x={col * CELL + 3} y={row * CELL + 3} width="2" height="2" className="fill-line" />
          ),
        ),
      )}
    </svg>
  );
}

/** The rally screen, in cells: two rackets, the net, and the shuttle at the top of its flight. */
const SCREEN = { cols: 25, rows: 9 };
const RACKETS: [number, number][] = [
  [1, 5],
  [1, 6],
  [23, 5],
  [23, 6],
];
const NET: [number, number][] = [
  [12, 6],
  [12, 7],
  [12, 8],
];
const SHUTTLE: [number, number] = [17, 1];
/** Where the shuttle has been: an arc up from the left racket, every other cell. */
const TRAIL: [number, number][] = [3, 5, 7, 9, 11, 13, 15].map((col) => [
  col,
  Math.round(1 + 4 * ((SHUTTLE[0] - col) / (SHUTTLE[0] - 2)) ** 2),
]);

/** A still from the coming game, drawn like the thumbnails: lit cells in ink, unlit ones as faint dots. */
function RallyScreen() {
  const key = ([col, row]: [number, number]) => `${col}-${row}`;
  const taken = new Set([...RACKETS, ...NET, SHUTTLE, ...TRAIL].map(key));
  const cells: [number, number][] = [];
  for (let row = 0; row < SCREEN.rows; row++) for (let col = 0; col < SCREEN.cols; col++) cells.push([col, row]);
  const square = ([col, row]: [number, number], size: number, className: string) => (
    <rect
      key={key([col, row])}
      x={col * CELL + (CELL - size) / 2}
      y={row * CELL + (CELL - size) / 2}
      width={size}
      height={size}
      className={className}
    />
  );

  return (
    <svg
      width={SCREEN.cols * CELL}
      height={SCREEN.rows * CELL}
      viewBox={`0 0 ${SCREEN.cols * CELL} ${SCREEN.rows * CELL}`}
      className="block max-w-full"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      {cells.filter((cell) => !taken.has(key(cell))).map((cell) => square(cell, 2, "fill-line"))}
      {TRAIL.map((cell) => square(cell, 4, "fill-ink-soft"))}
      {NET.map((cell) => square(cell, 6, "fill-ink-soft"))}
      {RACKETS.map((cell) => square(cell, 6, "fill-ink"))}
      {square(SHUTTLE, 6, "fill-ink")}
    </svg>
  );
}

/** The Arcade: games as save files, one row each. */
export function Arcade({ games, copy, note }: { games: Game[]; copy: ArcadeCopy; note?: string }) {
  return (
    <div className="flex flex-1 flex-col">
      {games.length === 0 && <p className="text-ink-soft">{copy.empty}</p>}
      <ol aria-label={copy.list} hidden={games.length === 0}>
        {games.map((game) => (
          <li key={game.title} className="flex items-center gap-4 border-t border-grid py-5 first:border-t-0 first:pt-0">
            <Thumbnail title={game.title} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate font-medium leading-snug">{game.title}</p>
                {game.hours !== undefined && (
                  <p className="tnum shrink-0 font-medium leading-snug">
                    {game.hours} <span aria-hidden="true">{copy.hoursUnit}</span>
                    <span className="sr-only">{copy.hoursLabel}</span>
                  </p>
                )}
              </div>
              <dl className="mt-1.5 flex flex-wrap gap-x-5 gap-y-0.5 text-small">
                {game.rank && (
                  <div className="flex gap-1.5">
                    <dt className="text-ink-soft">{copy.rank}</dt>
                    <dd>{game.rank}</dd>
                  </div>
                )}
                {game.main && (
                  <div className="flex gap-1.5">
                    <dt className="text-ink-soft">{copy.main}</dt>
                    <dd>{game.main}</dd>
                  </div>
                )}
              </dl>
            </div>
          </li>
        ))}
      </ol>

      {/* The cabinet for the rally game, pinned to the bottom of the room level with the cards beside it. */}
      <div className="mt-auto pt-8">
        <div className={cn(ROOM_CARD_TALL, "flex flex-col justify-between gap-4")}>
          <RallyScreen />
          <div>
            <p className="font-medium leading-snug">{copy.rally}</p>
            {note && <p className="mt-1 text-small text-ink-soft">{note}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

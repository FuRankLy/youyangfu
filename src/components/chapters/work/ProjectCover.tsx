import { cn } from "@/lib/cn";
import { COVER_SIZES, coverSquares } from "./cover";

/** Lattice cell edge in SVG units. */
const CELL = 10;
/** Edge of the faint dot that marks each cell of the lattice, as a share of the cell. Smaller than the smallest square, so squares cover it. */
const DOT = 0.14;
/** Milliseconds: each square's own growth, and the spread of their start times. Together about 320. */
const GROW = 200;
const STAGGER = 120;

type ProjectCoverProps = {
  /** The project's slug. The same slug always draws the same cover. */
  slug: string;
  /** Lattice size. The picture is the same at any size, only finer or coarser. */
  cols?: number;
  rows?: number;
  /** Squares scale in with a short stagger when the cover is mounted. Remount (change `key`) to replay. */
  assemble?: boolean;
  className?: string;
};

const round = (n: number) => Math.round(n * 100) / 100;

/** Every cell of the lattice as a faint dot, in one path. */
function latticeDots(cols: number, rows: number) {
  const size = round(DOT * CELL);
  const inset = round((CELL - DOT * CELL) / 2);
  let d = "";
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) d += `M${col * CELL + inset} ${row * CELL + inset}h${size}v${size}h${-size}z`;
  }
  return d;
}

/**
 * The cover for a project without an image: ink squares on a lattice of faint
 * dots. A project with pixel art (art.ts) shows that; any other gets an
 * abstract composition from its slug. Decorative, so it is hidden from
 * assistive technology. Fills the width of its container.
 */
export function ProjectCover({ slug, cols = 24, rows = 16, assemble = false, className }: ProjectCoverProps) {
  const squares = coverSquares(slug, cols, rows).map((square) => {
    const size = COVER_SIZES[square.level] * CELL;
    return {
      ...square,
      size: round(size),
      x: round(square.col * CELL + (CELL - size) / 2),
      y: round(square.row * CELL + (CELL - size) / 2),
    };
  });

  return (
    <svg
      viewBox={`0 0 ${cols * CELL} ${rows * CELL}`}
      className={cn("block h-auto w-full fill-ink", className)}
      aria-hidden="true"
      focusable="false"
    >
      {/* The lattice is there from the start; while a cover assembles, its squares land on it. */}
      <path d={latticeDots(cols, rows)} className="fill-grid" />
      {assemble ? (
        squares.map((s) => (
          <rect
            key={`${s.col}-${s.row}`}
            x={s.x}
            y={s.y}
            width={s.size}
            height={s.size}
            className="origin-center transition-transform ease-settle [transform-box:fill-box] starting:scale-0"
            style={{ transitionDuration: `${GROW}ms`, transitionDelay: `${Math.round(s.order * STAGGER)}ms` }}
          />
        ))
      ) : (
        // Still covers are one path, so a large lattice stays a single element.
        <path d={squares.map((s) => `M${s.x} ${s.y}h${s.size}v${s.size}h${-s.size}z`).join("")} />
      )}
    </svg>
  );
}

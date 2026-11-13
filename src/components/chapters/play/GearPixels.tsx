import type { GearArt } from "./gear-art";

/** Palette words that follow the colour mode. */
const THEMED: Record<string, string> = { ink: "var(--ink)", soft: "var(--ink-soft)" };

/**
 * A piece of gear as pixel art: one square per cell with a hairline gap, the
 * site's lattice. Each row fades in a moment after the one above, so a newly
 * shown item scans in from the top (still, with reduced motion).
 */
export function GearPixels({ art, box, className }: { art: GearArt; box: number; className?: string }) {
  const rows = art.rows.length;
  const cols = art.rows[0]?.length ?? 0;
  // Whole pixels per cell keep the gaps crisp.
  const cell = Math.max(2, Math.floor(box / Math.max(rows, cols)));
  const square = (cell - 1) / cell;
  const inset = 1 / (cell * 2);

  const paths = art.rows.map((row, y) => {
    const byColour = new Map<string, string>();
    [...row].forEach((char, x) => {
      const colour = art.palette[char];
      if (!colour) return;
      byColour.set(colour, `${byColour.get(colour) ?? ""}M${x + inset} ${y + inset}h${square}v${square}h${-square}z`);
    });
    return [...byColour];
  });

  return (
    <svg
      viewBox={`0 0 ${cols} ${rows}`}
      width={cols * cell}
      height={rows * cell}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {paths.map((row, y) => (
        <g key={y} className="pixel-row" style={{ "--row": y } as React.CSSProperties}>
          {row.map(([colour, d]) => (
            <path key={colour} d={d} style={{ fill: THEMED[colour] ?? colour }} />
          ))}
        </g>
      ))}
    </svg>
  );
}

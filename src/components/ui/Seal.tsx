import { GLYPH_BASELINE, GLYPH_BOX, SEAL_GRID, glyph } from "@/lib/hanzi";

const SIZE = 100;
const PAD = 9;
const GAP = 3.5;
const CELL = (SIZE - 2 * PAD - GAP) / 2;
const GROW = 1.1;
const K = (CELL * GROW) / GLYPH_BOX;

/**
 * Defines the seal once per page. Render it a single time in the root layout;
 * every <Seal /> then points at it, so the stroke paths ship only once.
 */
export function SealSprite() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
      <defs>
        <mask id="seal-carve" maskUnits="userSpaceOnUse" x="0" y="0" width={SIZE} height={SIZE}>
          <rect width={SIZE} height={SIZE} fill="#fff" />
          <g fill="#000" stroke="#000" strokeWidth={34} strokeLinejoin="round">
            {SEAL_GRID.flatMap((row, r) =>
              row.map((char, c) => {
                const x = PAD + c * (CELL + GAP) - (CELL * (GROW - 1)) / 2;
                const y = PAD + r * (CELL + GAP) - (CELL * (GROW - 1)) / 2;
                return (
                  <g key={char} transform={`translate(${x} ${y + GLYPH_BASELINE * K}) scale(${K} ${-K})`}>
                    {glyph(char).strokes.map((d, i) => (
                      <path key={i} d={d} />
                    ))}
                  </g>
                );
              }),
            )}
          </g>
        </mask>
        <symbol id="seal" viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <rect width={SIZE} height={SIZE} rx="3" fill="var(--cinnabar)" mask="url(#seal-carve)" />
        </symbol>
      </defs>
    </svg>
  );
}

type SealProps = {
  /** Edge length in pixels. */
  size?: number;
  className?: string;
  /** Leave empty when the seal is decorative. */
  label?: string;
};

/** The name seal 付优扬印: four characters carved out of a cinnabar square. */
export function Seal({ size = 28, className, label }: SealProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <use href="#seal" />
    </svg>
  );
}

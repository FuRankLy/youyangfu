import type { TowerData } from "./PlayTable";

/**
 * The tools as plain lists grouped by area, for screen readers. The blocks
 * above are a visual toy and hidden from them.
 */
export function ToolList({ towers, label, since }: { towers: TowerData[]; label: string; since: (year: number) => string }) {
  return (
    <div role="group" aria-label={label} className="sr-only">
      {towers.map((tower, t) => (
        <section key={tower.area} aria-labelledby={`stack-area-${t}`}>
          <h3 id={`stack-area-${t}`}>
            {tower.area}, {tower.countLabel}
          </h3>
          <ul>
            {tower.plaques.map((plaque) => (
              <li key={plaque.name}>
                {plaque.name}
                {plaque.since !== undefined && `, ${since(plaque.since)}`}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

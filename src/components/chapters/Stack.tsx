import { Chapter, DraftNote } from "@/components/ui/Chapter";
import { areas, stackCopy, stackIsPlaceholder, tools } from "@/content/stack";
import { PlayTable, type TowerData } from "./stack/PlayTable";
import { ToolList } from "./stack/ToolList";

// Tools as casino plaques you can pick up: one tower per area, one plaque per
// tool, the first listed at the bottom.
export function Stack() {
  const towers: TowerData[] = areas.map((area) => {
    const plaques = tools.filter((tool) => tool.area === area).map(({ name, since }) => ({ name, since }));
    return { area, countLabel: stackCopy.toolCount(plaques.length), plaques };
  });

  return (
    <Chapter id="stack">
      <ToolList towers={towers} label={stackCopy.groupLabel} since={stackCopy.since} />
      <PlayTable towers={towers} copy={{ hint: stackCopy.hint, reset: stackCopy.reset }} />
      {stackIsPlaceholder && <DraftNote file="src/content/stack.ts" className="mt-8" />}
    </Chapter>
  );
}

import { TransitionLink } from "@/components/shell/PageWipe";
import { STATUS_LABEL } from "@/content/projects";
import type { Project } from "@/content/types";
import { cn } from "@/lib/cn";
import { StatusMark } from "./StatusMark";

/** Column placement on the 12-column grid, shared by the header row and every project row. */
export const WORK_COLUMNS = {
  project: "md:col-span-4",
  year: "md:col-span-1",
  role: "md:col-span-2",
  stack: "md:col-span-3",
  status: "md:col-span-2 md:text-right",
} as const;

/** Read by screen readers between the cells, so the link's name is a sentence and not a run-on. */
function Comma() {
  return <span className="sr-only">, </span>;
}

/**
 * One project in the index. The whole row is a single link to the case study.
 * On phones the cells stack: title, then year and role, then stack, then status.
 */
export function WorkRow({ project }: { project: Project }) {
  return (
    <li className="border-b border-grid">
      <TransitionLink
        href={`/work/${project.slug}`}
        data-slug={project.slug}
        className={cn(
          "group/row grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1 py-5 text-small",
          "md:grid-12 md:gap-y-0 md:py-6",
          "transition-[color,opacity] duration-[160ms] ease-settle motion-reduce:transition-none",
          // The row in hand comes up to full ink and its title steps in (below);
          // while one row is hovered or focused, the others step back.
          project.placeholder && "text-ink-soft hover:text-ink focus-visible:text-ink active:text-ink",
          "group-hover/list:[&:not(:hover,:focus-visible)]:opacity-60",
          "group-has-[a:focus-visible]/list:[&:not(:hover,:focus-visible)]:opacity-60",
        )}
      >
        <span
          className={cn(
            "col-span-2 text-subhead font-medium",
            "transition-transform duration-[160ms] ease-settle",
            "group-hover/row:translate-x-2 group-focus-visible/row:translate-x-2",
            WORK_COLUMNS.project,
          )}
        >
          {project.title}
        </span>
        <Comma />
        <span className={cn("tnum", WORK_COLUMNS.year)}>{project.year}</span>
        <Comma />
        <span className={WORK_COLUMNS.role}>{project.role}</span>
        <Comma />
        <span className={cn("col-span-2", WORK_COLUMNS.stack)}>{project.stack.join(", ")}</span>
        <Comma />
        <span className={cn("col-span-2 text-ink-soft", WORK_COLUMNS.status)}>
          <StatusMark status={project.status} />
          {STATUS_LABEL[project.status]}
        </span>
      </TransitionLink>
    </li>
  );
}

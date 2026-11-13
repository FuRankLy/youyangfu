import type { ExperienceRole } from "@/content/types";

/**
 * Jobs and internships as a quiet list on the same grid as the project index:
 * the organisation large on the left, the role and a sentence or two in the
 * middle, the dates on the right. On phones each role stacks.
 */
export function ExperienceList({ roles, label }: { roles: ExperienceRole[]; label: string }) {
  return (
    <ol role="list" aria-label={label} data-assemble-items className="border-t border-line">
      {roles.map((item) => (
        <li
          key={`${item.organisation}-${item.dates}`}
          className="grid grid-cols-1 gap-y-2 border-b border-grid py-5 md:grid-12 md:gap-y-0 md:py-6"
        >
          <p className="text-subhead font-medium leading-tight md:col-span-4">{item.organisation}</p>
          <div className="grid gap-1 md:col-span-6">
            <p className="text-small font-medium">{item.role}</p>
            <p className="measure text-small text-ink-soft">{item.summary}</p>
          </div>
          <p className="tnum flex flex-wrap items-baseline gap-x-3 text-small text-ink-soft md:col-span-2 md:flex-col md:items-end md:text-right">
            <span>{item.dates}</span>
            {item.note && (
              <span className="text-ink">
                <span className="mr-2 inline-block h-2 w-2 translate-y-[-1px] bg-cinnabar" aria-hidden="true" />
                {item.note}
              </span>
            )}
          </p>
        </li>
      ))}
    </ol>
  );
}

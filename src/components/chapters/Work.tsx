import { TransitionLink } from "@/components/shell/PageWipe";
import { Chapter, DraftNote } from "@/components/ui/Chapter";
import { experience, experienceCopy } from "@/content/experience";
import { projects, projectsHavePlaceholders, workCopy } from "@/content/projects";
import { site } from "@/content/site";
import { ExperienceList } from "./work/ExperienceList";
import { WorkPreview } from "./work/WorkPreview";
import { WORK_COLUMNS, WorkRow } from "./work/WorkRow";

// Where I've worked, then what I've built. Both are quiet type on the page
// grid, one row each, no cards. Project rows open their case studies at
// /work/<slug>; everything else lives in the CV, linked beside the heading.
export function Work() {
  const { columns } = workCopy;
  return (
    <Chapter id="work">
      <div data-assemble className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h3 className="text-lead font-semibold">{experienceCopy.heading}</h3>
        <TransitionLink href={site.links.cv} className="link text-small font-medium">
          {experienceCopy.cv}
          <span aria-hidden="true" className="ml-1.5 text-ink-soft">
            {experienceCopy.cvFormat}
          </span>
        </TransitionLink>
      </div>
      <ExperienceList roles={experience} label={experienceCopy.heading} />

      <h3 data-assemble className="mb-4 mt-16 text-lead font-semibold md:mt-24">
        {workCopy.projects}
      </h3>
      <WorkPreview items={projects.map(({ slug, cover }) => ({ slug, cover }))}>
        {/* Rules, row text, the note and the draft note all share the page grid's left edge. */}
        <div>
          {/* Column names. Hidden from screen readers: each row reads as one sentence instead. */}
          <div aria-hidden="true" className="hidden border-b border-line pb-3 text-small text-ink-soft md:grid-12">
            <span className={WORK_COLUMNS.project}>{columns.project}</span>
            <span className={WORK_COLUMNS.year}>{columns.year}</span>
            <span className={WORK_COLUMNS.role}>{columns.role}</span>
            <span className={WORK_COLUMNS.stack}>{columns.stack}</span>
            <span className={WORK_COLUMNS.status}>{columns.status}</span>
          </div>
          <ol role="list" aria-label={workCopy.projects} data-assemble-items className="group/list border-t border-line md:border-t-0">
            {projects.map((project) => (
              <WorkRow key={project.slug} project={project} />
            ))}
          </ol>
        </div>
      </WorkPreview>

      <div className="mt-6 grid justify-items-start gap-3">
        <p className="text-small text-ink-soft">{workCopy.note}</p>
        {projectsHavePlaceholders && <DraftNote file="src/content/projects.ts" />}
      </div>
    </Chapter>
  );
}

import type { Metadata, ResolvingMetadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { HanText } from "@/components/chapters/work/HanText";
import { ProjectCover } from "@/components/chapters/work/ProjectCover";
import { StatusMark } from "@/components/chapters/work/StatusMark";
import { TransitionLink } from "@/components/shell/PageWipe";
import { DraftNote } from "@/components/ui/Chapter";
import { STATUS_LABEL, nextProject, projectBySlug, projects, workCopy } from "@/content/projects";
import { cn } from "@/lib/cn";

type Props = { params: Promise<{ slug: string }> };

// A case study is the same for every visitor, so the whole page is written to
// static HTML at build time, one file per project. `ensureStatic` makes the
// build fail if anything request-specific ever creeps in, and makes an unknown
// slug wait for its real answer (a 404) instead of a loading shell.
export const ensureStatic = "navigation";

// Reading the slug means a visit can't paint before the server answers. That
// is fine here: the answer is a static file, and the square wipe covers the wait.
export const instant = false;

export function generateStaticParams() {
  return projects.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props, parent: ResolvingMetadata): Promise<Metadata> {
  const { slug } = await params;
  const project = projectBySlug(slug);
  if (!project) notFound();
  const inherited = (await parent).openGraph;
  const url = `/work/${project.slug}`;
  return {
    title: project.title,
    description: project.summary,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      siteName: inherited?.siteName,
      locale: inherited?.locale,
      images: inherited?.images,
      title: project.title,
      description: project.summary,
    },
    twitter: { card: "summary_large_image", title: project.title, description: project.summary },
    // Sample projects stay out of search results until they are real.
    robots: project.placeholder ? { index: false } : undefined,
  };
}

function Fact({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <dt className="text-small text-ink-soft">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

export default async function CaseStudy({ params }: Props) {
  const { slug } = await params;
  const project = projectBySlug(slug);
  if (!project) notFound();
  const next = nextProject(project.slug);
  const { columns } = workCopy;

  return (
    <article className="wrap pb-24 pt-[calc(var(--header-h)+2.5rem)] md:pb-32 md:pt-[calc(var(--header-h)+4rem)]">
      <p>
        <TransitionLink href="/#work" className="link text-small">
          {workCopy.back}
        </TransitionLink>
      </p>

      <header className="mt-10 md:mt-14">
        <h1 className="text-display font-semibold">
          <HanText>{project.title}</HanText>
        </h1>
        <p className="measure mt-6 text-lead">
          <HanText>{project.summary}</HanText>
        </p>
      </header>

      <dl className="mt-12 grid-12 gap-y-6 border-t border-line pt-6 md:mt-16">
        <Fact label={columns.year} className="col-span-4 md:col-span-2">
          <span className="tnum">{project.year}</span>
        </Fact>
        <Fact label={columns.role} className="col-span-8 md:col-span-3 lg:col-span-2">
          {project.role}
        </Fact>
        <Fact label={columns.stack} className="col-span-12 md:col-span-4">
          {project.stack.join(", ")}
        </Fact>
        <Fact label={columns.status} className="col-span-12 md:col-span-3 lg:col-span-2">
          <StatusMark status={project.status} className="translate-y-[-1px]" />
          {STATUS_LABEL[project.status]}
        </Fact>
        {project.links.length > 0 && (
          <Fact label={columns.links} className="col-span-12 lg:col-span-2">
            <ul role="list" className="grid gap-1">
              {project.links.map((link) => (
                <li key={link.href}>
                  {link.href.startsWith("/") ? (
                    <TransitionLink href={link.href} className="link">
                      {link.label}
                    </TransitionLink>
                  ) : (
                    <a href={link.href} target="_blank" rel="noreferrer" className="link">
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </Fact>
        )}
      </dl>

      {project.cover ? (
        <div className="relative mt-12 aspect-video overflow-hidden rounded-[2px] border border-line bg-surface md:mt-16">
          <Image
            src={project.cover}
            alt={project.coverAlt ?? ""}
            fill
            sizes="(min-width: 90rem) 1360px, 100vw"
            fetchPriority="high"
            className="object-cover"
          />
        </div>
      ) : (
        // Until there is an image: the project's square cover (its pixel art, or one generated from the slug), the same one the index previews.
        <div className="mt-12 rounded-[2px] border border-line bg-surface p-3 sm:p-4 md:mt-16 md:p-6">
          <ProjectCover slug={project.slug} cols={48} rows={27} />
        </div>
      )}

      <div className="mt-16 md:mt-24">
        {project.sections.map((section, i) => (
          <section
            key={section.heading}
            className={cn("grid-12 gap-y-4 py-10 md:py-14", i > 0 && "border-t border-grid")}
          >
            <h2 className="col-span-12 text-heading font-semibold md:col-span-4">
              <HanText>{section.heading}</HanText>
            </h2>
            <div className="measure col-span-12 grid gap-4 md:col-span-7 md:col-start-6">
              {section.body.map((paragraph) => (
                <p key={paragraph}>
                  <HanText>{paragraph}</HanText>
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>

      {project.placeholder && <DraftNote file="src/content/projects.ts" />}

      <nav aria-label={workCopy.next} className="mt-16 border-t border-line pt-8 md:mt-24 md:pt-10">
        <TransitionLink href={`/work/${next.slug}`} className="group inline-grid gap-2">
          <span className="text-small text-ink-soft">{workCopy.next}</span>
          <span className="text-title font-semibold transition-transform duration-[160ms] ease-settle group-hover:translate-x-2 group-focus-visible:translate-x-2">
            <HanText>{next.title}</HanText>
          </span>
        </TransitionLink>
      </nav>
    </article>
  );
}

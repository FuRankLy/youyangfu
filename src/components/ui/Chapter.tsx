import { Fragment, type CSSProperties } from "react";
import { chapterById, numeralNote, site } from "@/content/site";
import { cn } from "@/lib/cn";

type ChapterProps = {
  /** One of the ids in content/site.ts `chapters`. */
  id: string;
  children: React.ReactNode;
  className?: string;
  /** Extra content on the right of the heading row, e.g. a view switch. */
  aside?: React.ReactNode;
};

/**
 * A home-page chapter: the section, its anchor, and its heading with the
 * financial numeral. The numeral always carries its number in plain digits
 * beneath it, so it reads for everyone. Everything a chapter shows goes in as
 * children.
 */
export function Chapter({ id, children, className, aside }: ChapterProps) {
  const meta = chapterById(id);
  return (
    <section id={id} data-chapter={id} aria-labelledby={`${id}-title`} className={cn("chapter-space overflow-x-clip", className)}>
      <div className="wrap">
        <header className="mb-12 flex flex-wrap items-end justify-between gap-x-10 gap-y-6 md:mb-16">
          <div className="flex items-baseline gap-4 md:gap-6">
            <span
              data-assemble="drop"
              className="inline-grid shrink-0 cursor-help justify-items-center gap-1.5"
              title={numeralNote(meta.numeral, meta.number)}
              aria-hidden="true"
            >
              <span className="han text-heading leading-none text-cinnabar md:text-title" lang="zh-Hans">
                {meta.numeral}
              </span>
              <span className="tnum text-tiny font-medium leading-none text-ink-soft">{meta.number}</span>
            </span>
            <div className="grid gap-2">
              <h2 id={`${id}-title`} className="text-title font-semibold">
                <span className="sr-only">Chapter {meta.number}: </span>
                {meta.title.split(" ").map((word, j, words) => (
                  <Fragment key={j}>
                    <span
                      data-assemble="word"
                      className="inline-block"
                      style={{ "--i": 0.4 + j * 0.5, "--ax": `${(j % 2 ? 1 : -1) * (1.5 + j)}rem`, "--ay": "0.6rem" } as CSSProperties}
                    >
                      {word}
                    </span>
                    {j < words.length - 1 && " "}
                  </Fragment>
                ))}
              </h2>
              <p data-assemble className="measure text-lead text-ink-soft" style={{ "--i": 1.6, "--ay": "1rem" } as CSSProperties}>
                {meta.blurb}
              </p>
            </div>
          </div>
          {aside && (
            <div data-assemble="right" style={{ "--i": 2 } as CSSProperties}>
              {aside}
            </div>
          )}
        </header>
        {children}
      </div>
    </section>
  );
}

/** Marks sample content, so nobody mistakes it for the real thing before launch. */
export function DraftNote({ file, className }: { file: string; className?: string }) {
  if (!site.showDraftNotes || process.env.NODE_ENV === "production") return null;
  return (
    <p className={cn("text-tiny text-ink-soft", className)}>
      <span className="mr-2 inline-block h-2 w-2 translate-y-[-1px] border border-cinnabar align-middle" aria-hidden="true" />
      Placeholder content. Replace it in <code className="font-mono text-[0.95em]">{file}</code>.
    </p>
  );
}

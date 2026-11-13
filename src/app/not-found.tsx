import type { Metadata } from "next";
import { TransitionLink } from "@/components/shell/PageWipe";
import { WrittenGlyphs } from "@/components/squares/WrittenGlyphs";
import { buttonClass } from "@/components/ui/Button";
import { notFound as copy } from "@/content/pages";

export const metadata: Metadata = { title: copy.title, robots: { index: false } };

export default function NotFound() {
  return (
    <section className="wrap grid min-h-svh content-center justify-items-center gap-2 pb-16 pt-[calc(var(--header-h)+2rem)] text-center">
      <WrittenGlyphs
        chars={copy.chars}
        pinyin={copy.pinyin}
        label={copy.figureLabel}
        className="h-[clamp(15rem,42svh,24rem)] max-w-[44rem]"
      />
      <h1 className="text-heading font-semibold">{copy.heading}</h1>
      <p className="measure text-ink-soft">
        <span className="han" lang="zh-Hans">
          {copy.term}
        </span>{" "}
        {copy.note}
      </p>
      <p className="mt-6 flex flex-wrap justify-center gap-3">
        <TransitionLink href="/" className={buttonClass("solid")}>
          Back home
        </TransitionLink>
        <TransitionLink href="/#work" className={buttonClass("outline")}>
          See my work
        </TransitionLink>
      </p>
    </section>
  );
}

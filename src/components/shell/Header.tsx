"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { nav, site } from "@/content/site";
import { cn } from "@/lib/cn";
import { Seal } from "@/components/ui/Seal";
import { ModeChoice, ModeSwitch } from "./ModeSwitch";
import { TransitionLink } from "./PageWipe";
import { useScroll } from "./SmoothScroll";

/** Which chapter is crossing the middle of the screen, on the home page. */
function useActiveChapter(enabled: boolean) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-chapter]"));
    if (sections.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.chapter ?? null;
          if (entry.isIntersecting) setActive(id);
          else setActive((current) => (current === id ? null : current));
        }
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [enabled]);

  return enabled ? active : null;
}

/** Hides the header while scrolling down and brings it back on the way up. */
function useHeaderState() {
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const last = useRef(0);

  useEffect(() => {
    last.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 8);
      if (y > last.current + 6 && y > 160) setHidden(true);
      else if (y < last.current - 6 || y <= 160) setHidden(false);
      last.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return { hidden, scrolled, show: () => setHidden(false) };
}

export function Header() {
  const pathname = usePathname();
  const onHome = pathname === "/";
  const active = useActiveChapter(onHome);
  const { hidden, scrolled, show } = useHeaderState();
  const { lock } = useScroll();
  const menuRef = useRef<HTMLDialogElement>(null);

  const isCurrent = (item: (typeof nav)[number]) =>
    item.chapters ? item.chapters.includes(active ?? "") : pathname === item.href;

  const openMenu = () => {
    menuRef.current?.showModal();
    lock(true);
  };
  const closeMenu = () => menuRef.current?.close();

  return (
    <>
      <header
        onFocus={show}
        data-hidden={hidden}
        className={cn(
          "fixed inset-x-0 top-0 z-40 transition-[transform,background-color,border-color] duration-[320ms] ease-settle",
          "border-b data-[hidden=true]:-translate-y-full",
          scrolled ? "border-grid bg-paper/85 backdrop-blur-md" : "border-transparent bg-transparent",
        )}
      >
        <div className="wrap flex h-[var(--header-h)] items-center justify-between gap-6">
          <TransitionLink href="/" className="-ml-1 flex items-center gap-3 p-1" aria-label={`${site.name.display}, home`}>
            <Seal size={28} />
            <span className="font-medium tracking-[-0.01em]">{site.name.display}</span>
          </TransitionLink>

          <div className="flex items-center gap-1 md:gap-5">
            <nav aria-label="Main" className="hidden md:block">
              <ul className="flex items-center gap-7 text-small font-medium">
                {nav.map((item) => {
                  const current = isCurrent(item);
                  return (
                    <li key={item.href}>
                      <TransitionLink
                        href={item.href}
                        aria-current={current ? (item.chapters ? "location" : "page") : undefined}
                        className="group relative block py-2"
                      >
                        {item.label}
                        <span
                          aria-hidden="true"
                          className={cn(
                            "absolute inset-x-0 bottom-1 h-[1.5px] origin-left bg-cinnabar transition-transform duration-[320ms] ease-settle",
                            current ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
                          )}
                        />
                      </TransitionLink>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <ModeSwitch />
            <button
              type="button"
              onClick={openMenu}
              className="-mr-2 grid h-10 w-10 place-items-center md:hidden"
              aria-label="Open menu"
              aria-haspopup="dialog"
            >
              <span aria-hidden="true" className="grid w-4 gap-[5px]">
                <span className="h-[1.5px] bg-ink" />
                <span className="h-[1.5px] bg-ink" />
              </span>
            </button>
          </div>
        </div>
      </header>

      <dialog
        ref={menuRef}
        onClose={() => lock(false)}
        aria-label="Menu"
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-paper p-0 text-ink backdrop:bg-transparent open:flex open:flex-col"
      >
        <div className="wrap flex h-[var(--header-h)] flex-none items-center justify-between">
          <span className="flex items-center gap-3">
            <Seal size={28} />
            <span className="font-medium tracking-[-0.01em]">{site.name.display}</span>
          </span>
          <button type="button" onClick={closeMenu} className="-mr-2 grid h-10 w-10 place-items-center" aria-label="Close menu">
            <span aria-hidden="true" className="relative block h-4 w-4">
              <span className="absolute inset-x-0 top-1/2 h-[1.5px] -translate-y-1/2 rotate-45 bg-ink" />
              <span className="absolute inset-x-0 top-1/2 h-[1.5px] -translate-y-1/2 -rotate-45 bg-ink" />
            </span>
          </button>
        </div>
        <nav aria-label="Menu" className="wrap flex flex-1 flex-col justify-center">
          <ul className="grid gap-1">
            {nav.map((item) => (
              <li key={item.href}>
                <TransitionLink
                  href={item.href}
                  onClick={closeMenu}
                  aria-current={isCurrent(item) ? (item.chapters ? "location" : "page") : undefined}
                  className="block py-2 text-title font-semibold aria-[current]:text-cinnabar"
                >
                  {item.label}
                </TransitionLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="wrap flex flex-none items-center justify-between gap-4 pb-8">
          <ModeChoice />
          <span className="han text-lead text-ink-soft" lang="zh-Hans">
            {site.name.chinese}
          </span>
        </div>
      </dialog>
    </>
  );
}

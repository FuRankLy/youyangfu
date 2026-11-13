import { nav, site } from "@/content/site";
import { LifePercent, LiveClock } from "@/components/ui/Live";
import { Seal } from "@/components/ui/Seal";
import { TransitionLink } from "./PageWipe";

export function Footer() {
  const { hometown, home } = site.places;
  return (
    <footer className="border-t border-grid">
      <div className="wrap grid gap-10 py-12 md:grid-cols-[auto_1fr_auto] md:items-start md:gap-16">
        <Seal size={44} label={`${site.name.display}'s name seal, ${site.name.chinese}印`} />

        <div className="grid gap-8 sm:grid-cols-[auto_auto_1fr] sm:gap-12">
          <p className="grid gap-1">
            <span className="text-small text-ink-soft">{home.name}</span>
            <LiveClock timeZone={home.tz} className="text-lead font-semibold" />
          </p>
          <p className="grid gap-1">
            <span className="text-small text-ink-soft">
              {hometown.name}{" "}
              <span className="han" lang="zh-Hans">
                {hometown.chinese}
              </span>
            </span>
            <LiveClock timeZone={hometown.tz} className="text-lead font-semibold" />
          </p>
          <p className="grid gap-1">
            <span className="text-small text-ink-soft">Of my life in Aotearoa</span>
            <LifePercent digits={4} className="text-lead font-semibold" />
          </p>
        </div>

        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-small font-medium md:justify-end">
            {nav.map((item) => (
              <li key={item.href}>
                <TransitionLink href={item.href} className="link">
                  {item.label}
                </TransitionLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="wrap flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 border-t border-grid py-6 text-small text-ink-soft">
        <p>
          © {site.name.display},{" "}
          <span className="han" lang="zh-Hans">
            {site.name.chinese}
          </span>
        </p>
        <p>Built with Next.js in Auckland</p>
      </div>
    </footer>
  );
}

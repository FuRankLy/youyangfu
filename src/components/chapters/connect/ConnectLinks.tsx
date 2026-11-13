import { TransitionLink } from "@/components/shell/PageWipe";
import { site } from "@/content/site";
import { cn } from "@/lib/cn";

/** "https://github.com/someone/" as "github.com/someone". */
function shortAddress(href: string) {
  try {
    const url = new URL(href);
    return (url.host.replace(/^www\./, "") + url.pathname).replace(/\/$/, "");
  } catch {
    return href;
  }
}

const row = "flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-grid py-4";
const where = "text-small text-ink-soft";

/**
 * Where else to find the owner. A profile without an address yet shows as
 * plain text marked "coming soon", and becomes a real link by itself once its
 * address is filled in at `site.links`.
 *
 * The email address is read from CONTACT_TO_EMAIL (the inbox the form sends
 * to) when the page is built, so it never sits in the repository. Without it,
 * the row is left out.
 */
export function ConnectLinks() {
  const email = process.env.CONTACT_TO_EMAIL?.trim();
  const profiles = [
    { label: "GitHub", href: site.links.github },
    { label: "LinkedIn", href: site.links.linkedin },
  ];

  return (
    <div>
      <ul className="border-t border-grid">
        {profiles.map(({ label, href }) => (
          <li key={label} className={row}>
            {href ? (
              <>
                <a href={href} target="_blank" rel="me noopener noreferrer" className="link text-lead font-medium">
                  {label}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
                <span className={where}>{shortAddress(href)}</span>
              </>
            ) : (
              <>
                <span className="text-lead font-medium text-ink-soft">{label}</span>
                <span className={where}>coming soon</span>
              </>
            )}
          </li>
        ))}
        {email && (
          <li className={row}>
            <a href={`mailto:${email}`} className="link text-lead font-medium">
              Email
            </a>
            <span className={cn(where, "break-all")}>{email}</span>
          </li>
        )}
        <li className={row}>
          <TransitionLink href={site.links.cv} className="link text-lead font-medium">
            CV
          </TransitionLink>
          <span className={where}>PDF</span>
        </li>
      </ul>
    </div>
  );
}

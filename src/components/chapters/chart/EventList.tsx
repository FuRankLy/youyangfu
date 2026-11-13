import type { LifeEvent, LifePeriod, Listing, Market } from "@/content/types";
import { cn } from "@/lib/cn";
import { monthIndex, monthRange } from "./series";

type Props = {
  periods: LifePeriod[];
  events: LifeEvent[];
  listings: Record<Market, Listing>;
  copy: { now: string; listedOn: (exchangeName: string) => string; listHeading: string; market: string };
};

/**
 * The same timeline as plain text: each place I've lived, and what happened
 * there. Only facts; no generated movement. In the page from the start, so it
 * reads without JavaScript and for screen readers.
 */
export function EventList({ periods, events, listings, copy }: Props) {
  return (
    <ol aria-label={copy.listHeading} data-assemble-items className="border-t border-line">
      {periods.map((period) => {
        const from = monthIndex(period.from);
        const to = period.to ? monthIndex(period.to) : undefined;
        const listing = listings[period.market];
        const here = events.filter((e) => {
          const at = monthIndex(e.from);
          return at >= from && (to === undefined || at <= to);
        });
        return (
          <li key={period.place} className="grid gap-y-3 border-b border-grid py-6 md:grid-12 md:py-8">
            <div className="md:col-span-4">
              <h3 className="text-subhead font-medium leading-tight">{period.place}</h3>
              <p className="mt-1 text-small text-ink-soft">{period.country}</p>
              <p className="tnum mt-3 text-small">{monthRange(from, to, copy.now)}</p>
              <p className="mt-1 text-small text-ink-soft">
                {copy.listedOn(listing.exchangeName)} as{" "}
                <span className={cn("text-ink", listing.nameLang && "han")} lang={listing.nameLang}>
                  {listing.name}
                </span>
              </p>
            </div>
            <ul className="grid content-start gap-4 md:col-span-7 md:col-start-6">
              {here.map((event) => (
                <li key={event.id}>
                  <p className="tnum text-small text-ink-soft">
                    {monthRange(monthIndex(event.from), event.to ? monthIndex(event.to) : monthIndex(event.from), copy.now)}
                  </p>
                  <p className="font-medium">{event.title}</p>
                  {event.detail && <p className="text-small text-ink-soft">{event.detail}</p>}
                  {event.market && (
                    <p className="measure mt-1.5 text-small text-ink-soft">
                      <span className="font-medium text-ink">{copy.market}</span> {event.market}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}

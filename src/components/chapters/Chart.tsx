import type { CSSProperties } from "react";
import { Chapter } from "@/components/ui/Chapter";
import { chartCopy, events, listings, periods } from "@/content/timeline";
import { ChartViews, ViewPanel, ViewSwitch } from "./chart/ChartViews";
import { EventList } from "./chart/EventList";
import { LifeChart } from "./chart/LifeChart";

/**
 * 贰 The chart: my life as a market chart, one candle per month from birth to
 * now, with a List view of the same places and events as plain text. All of
 * it comes from src/content/timeline.ts.
 */
export function Chart() {
  return (
    <ChartViews>
      <Chapter
        id="chart"
        aside={<ViewSwitch label={chartCopy.views.switchLabel} names={{ chart: chartCopy.views.chart, list: chartCopy.views.list }} />}
      >
        <ViewPanel view="chart">
          <figure>
            <div data-assemble>
            <LifeChart
              periods={periods}
              events={events}
              listings={listings}
              copy={{
                plotLabel: chartCopy.plotLabel,
                now: chartCopy.now,
                forming: chartCopy.forming,
                market: chartCopy.market,
                hint: chartCopy.hint,
                ranges: chartCopy.ranges,
                all: chartCopy.all,
              }}
            />
            </div>
            <figcaption data-assemble className="measure mt-6 grid gap-3 text-small text-ink-soft" style={{ "--i": 1 } as CSSProperties}>
              {chartCopy.caption.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </figcaption>
          </figure>
        </ViewPanel>
        <ViewPanel view="list">
          <EventList
            periods={periods}
            events={events}
            listings={listings}
            copy={{ now: chartCopy.now, listedOn: chartCopy.listedOn, listHeading: chartCopy.listHeading, market: chartCopy.market }}
          />
        </ViewPanel>
      </Chapter>
    </ChartViews>
  );
}

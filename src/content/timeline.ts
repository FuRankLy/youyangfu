import type { LifeEvent, LifePeriod, Listing, Market } from "./types";

/**
 * The life chart: one candle per month from birth to the current month, drawn
 * the way a market would draw a stock.
 *
 * Only the periods and events below are real, and only facts the owner has
 * given go in them. The movement between events is generated from a fixed
 * seed, so it looks the same on every visit, and it re-forms as events are
 * added: an event with a `lift` steps the line up, one with `shake` makes it
 * move more for a while, and anything with a `flag` is marked under the chart.
 */

export const listings = {
  SSE: { exchange: "SSE", exchangeName: "Shanghai Stock Exchange", name: "付优扬", nameLang: "zh-Hans" },
  NZX: { exchange: "NZX", exchangeName: "New Zealand Exchange", name: "FRK" },
} as const satisfies Record<Market, Listing>;

export const periods: LifePeriod[] = [
  { place: "Zhengzhou", country: "China", from: "2006-03", to: "2016-06", market: "SSE" },
  { place: "Hamilton", country: "New Zealand", from: "2016-07", to: "2024-02", market: "NZX" },
  { place: "Auckland", country: "New Zealand", from: "2024-03", market: "NZX" },
];

/** In date order. */
export const events: LifeEvent[] = [
  {
    id: "born",
    title: "Born in Zhengzhou",
    from: "2006-03",
    flag: "Born",
    market: "After nearly 214 years as a not-for-profit, the New York Stock Exchange began trading its own shares on 8 March 2006.",
  },
  {
    id: "new-zealand",
    market: "Pokémon Go more than doubled Nintendo's market value, to about US$42 billion, within two weeks of its 6 July 2016 launch.",
    title: "Moved to New Zealand",
    detail: "Grew up in Hamilton.",
    from: "2016-07",
    flag: "Moved to NZ",
    shake: true,
  },
  {
    id: "pb-technologies",
    market: "Google owner Alphabet split its stock 20-for-1, so shares worth over US$2,200 opened at around US$112 on 18 July 2022.",
    title: "Technical assistant at PB Technologies",
    from: "2022-07",
    to: "2025-03",
    flag: "PB Technologies",
    lift: 0.05,
  },
  {
    id: "graduated",
    market: "Microsoft stock closed at a record on 20 November 2023, after it announced it would hire Sam Altman, just ousted from OpenAI.",
    title: "Graduated from Hamilton Boys’ High School",
    from: "2023-11",
    flag: "Graduated",
    lift: 0.04,
  },
  {
    id: "auckland",
    market: "Reddit's shares closed 48% above their US$34 IPO price on their first day of trading, 21 March 2024.",
    title: "Moved to Auckland and started university",
    detail: "Bachelor of Engineering (Honours) in Software Engineering at the University of Auckland.",
    from: "2024-03",
    flag: "Moved to Auckland",
    lift: 0.12,
    shake: true,
  },
  {
    id: "harmoney",
    market: "Indian trading app Groww closed about 30% above its IPO price on its 12 November 2025 debut, valuing it near US$9 billion.",
    title: "Software engineer intern at Harmoney",
    from: "2025-11",
    to: "2026-02",
    flag: "Harmoney",
    lift: 0.1,
  },
  {
    id: "sandfield",
    market: "Xero, the accounting software company founded in New Zealand, announced an A$1 billion share buyback on 12 November 2026.",
    title: "Software developer intern at Sandfield",
    detail: "Summer internship, building and automating tools for New Zealand-wide animal and organic product transportation.",
    from: "2026-11",
    to: "2027-02",
    flag: "Sandfield",
    lift: 0.06,
  },
];

/** Wording on and around the chart. */
export const chartCopy = {
  caption: [
    "Each candle is one month of my life: green when the month closed higher than it opened, red when it closed lower. The places and the flagged events are real. The movement in between is generated for now, and fills in as I add more of my story.",
    "My years in China trade under my Chinese name, 付优扬 (Fù Yōuyáng), on the Shanghai Stock Exchange. Since I moved to New Zealand, I trade as FRK on the NZX.",
  ],
  /** Read out for the chart as a whole. */
  plotLabel:
    "Life chart, one candle per month since March 2006. Left and right arrow keys move between candles, Page Up and Page Down jump a year, Home and End go to the first and latest month, plus and minus zoom, and 0 resets the view.",
  views: { chart: "Chart", list: "List", switchLabel: "Show my timeline as" },
  /** Ends the range of something still going: "Mar 2024 to now". */
  now: "now",
  /** Marks the month still in progress. */
  forming: "This month, still forming",
  /** Before the stock market fact for an event. */
  market: "Markets that month:",
  hint: "Drag to move through time. Pinch, or hold Ctrl and scroll, to zoom.",
  ranges: "Time range",
  all: "All",
  listedOn: (exchangeName: string) => `Listed on the ${exchangeName}`,
  listHeading: "Where I've lived, and what happened",
} as const;

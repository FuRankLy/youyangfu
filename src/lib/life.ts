// Date maths about the owner's life. Pure functions of a moment passed in, so
// they can run on the server inside "use cache" or on the client in an effect.
import { site } from "@/content/site";

const DAY = 86400000;
const YEAR = 365.2425 * DAY;

const born = Date.parse(site.life.born + "T00:00:00+08:00");
const arrived = Date.parse(site.life.arrived + "T00:00:00+12:00");

export type LifeSplit = {
  /** Years lived in Zhengzhou. Fixed. */
  chinaYears: number;
  /** Years lived in New Zealand so far. */
  nzYears: number;
  /** Share of life spent in New Zealand, 0 to 100. */
  nzPercent: number;
};

export function lifeSplit(now: number): LifeSplit {
  const china = arrived - born;
  const nz = Math.max(0, now - arrived);
  return {
    chinaYears: china / YEAR,
    nzYears: nz / YEAR,
    nzPercent: (100 * nz) / (china + nz),
  };
}

/** The moment time in New Zealand overtakes time in China. */
export function crossoverTime() {
  return arrived + (arrived - born);
}

export const lifeDates = { born, arrived };

const ORDINALS = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth"];

/**
 * Year of study, derived from the start date so nobody has to edit it.
 * The academic year rolls over on 1 March. After the final year it reports
 * the degree as finished.
 */
export function studyStatus(now: number) {
  const { start, years } = site.education;
  const startDate = new Date(start + "T00:00:00+13:00");
  const date = new Date(now);
  let year = date.getUTCFullYear() - startDate.getUTCFullYear() + 1;
  // Before 1 March (NZ), the new academic year hasn't begun.
  const rollover = Date.parse(`${date.getUTCFullYear()}-03-01T00:00:00+13:00`);
  if (now < rollover) year -= 1;
  if (year < 1) year = 1;
  if (year > years) return { finished: true as const, year: years, label: "Graduate" };
  return { finished: false as const, year, label: `${ORDINALS[year - 1]} year` };
}

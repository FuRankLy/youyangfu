// The time difference between two IANA zones at a given moment, worked out
// from the zones themselves so daylight saving is always right.

const formatters = new Map<string, Intl.DateTimeFormat>();

/** Minutes a zone's wall clock is ahead of UTC at the given moment. */
function offsetMinutes(at: number, timeZone: string) {
  let format = formatters.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatters.set(timeZone, format);
  }
  const whole = Math.floor(at / 1000) * 1000;
  const parts: Record<string, number> = {};
  for (const part of format.formatToParts(new Date(whole))) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  const wall = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return Math.round((wall - whole) / 60_000);
}

/** Hours the first zone is ahead of the second at the given moment. Negative if it is behind. */
export function zoneGapHours(at: number, zone: string, other: string) {
  return (offsetMinutes(at, zone) - offsetMinutes(at, other)) / 60;
}

/** "+5 h", "−3.5 h". */
export function formatGap(hours: number) {
  const size = Math.abs(hours);
  return `${hours < 0 ? "−" : "+"}${Number.isInteger(size) ? size : size.toFixed(1)} h`;
}

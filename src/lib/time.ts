// Clock helpers. Everything here takes the moment as an argument, so server
// components never read the current time by accident (see Cache Components docs).

const timeFormatters = new Map<string, Intl.DateTimeFormat>();

/** "9:40 pm" in the given IANA time zone. */
export function formatTime(date: Date, timeZone: string) {
  let fmt = timeFormatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-NZ", { timeZone, hour: "numeric", minute: "2-digit" });
    timeFormatters.set(timeZone, fmt);
  }
  return fmt.format(date).replace(/ | /g, " ");
}

/** Hour of the day, 0 to 23, in the given time zone. */
export function hourIn(date: Date, timeZone: string) {
  const hour = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(date);
  return Number(hour);
}

/** Day of the week, 0 = Sunday, in the given time zone. */
export function weekdayIn(date: Date, timeZone: string) {
  const name = new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short" }).format(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}

/** "It's 11:02 am in Auckland." Used under the contact form's Send button, to show the time zone. No promises. */
export function localTimeLine(date: Date, timeZone = "Pacific/Auckland") {
  return `It's ${formatTime(date, timeZone)} in Auckland.`;
}

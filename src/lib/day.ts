/** The instant the local day containing `now` began in `timeZone` (IANA name). Unknown zones use UTC. */
export function startOfDay(now: Date, timeZone: string): Date {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(now);
  } catch {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  // Time elapsed since local midnight, read off the wall clock in that zone.
  const sinceMidnightMs = ((get("hour") * 60 + get("minute")) * 60 + get("second")) * 1000 + now.getUTCMilliseconds();
  return new Date(now.getTime() - sinceMidnightMs);
}

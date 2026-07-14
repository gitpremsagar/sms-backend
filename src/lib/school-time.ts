/** School operates in India Standard Time. Hosting may run in UTC. */
export const SCHOOL_TIME_ZONE = "Asia/Kolkata";

export type SchoolDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function getSchoolDateTimeParts(now = new Date()): SchoolDateTimeParts {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: SCHOOL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((entry) => entry.type === type);
    return Number(part?.value ?? "0");
  };

  let hour = value("hour");
  if (hour === 24) {
    hour = 0;
  }

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour,
    minute: value("minute"),
    second: value("second"),
  };
}

/** Today's date in the school timezone as YYYY-MM-DD. */
export function schoolTodayDateString(now = new Date()): string {
  const { year, month, day } = getSchoolDateTimeParts(now);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Encode school wall-clock time as UTC date components so clients can display
 * with timeZone: "UTC" and show the same HH:mm everywhere.
 */
export function schoolWallClockNow(now = new Date()): Date {
  const { year, month, day, hour, minute, second } = getSchoolDateTimeParts(now);
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second, 0));
}

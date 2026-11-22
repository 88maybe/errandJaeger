// Time helpers. Everything is judged in Boston time (America/New_York),
// no matter where the server or phone is.

const TZ = "America/New_York";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export type NYParts = {
  year: number;
  month: number; // 1-12
  day: number;
  minutes: number; // minutes since midnight, Boston time
  dayKey: string; // "mon".."sun"
};

const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  weekday: "short",
  hourCycle: "h23",
});

// What does the wall clock in Boston say at this moment?
export function nyParts(date: Date): NYParts {
  const p: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) p[part.type] = part.value;
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    minutes: Number(p.hour) * 60 + Number(p.minute),
    dayKey: p.weekday.slice(0, 3).toLowerCase(),
  };
}

// The reverse: "Boston wall clock says Y-M-D H:MM" -> a real moment in time.
// (Daylight saving makes the offset change, so we correct our guess twice.)
export function nyDate(year: number, month: number, day: number, hour: number, minute: number): Date {
  const wanted = Date.UTC(year, month - 1, day, hour, minute);
  let guess = wanted;
  for (let i = 0; i < 2; i++) {
    const p = nyParts(new Date(guess));
    const shown = Date.UTC(p.year, p.month - 1, p.day, Math.floor(p.minutes / 60), p.minutes % 60);
    guess += wanted - shown;
  }
  return new Date(guess);
}

// "14:30" today in Boston -> a Date. Handy for the start-time picker.
export function todayAtNY(hhmm: string, now: Date = new Date()): Date {
  const { year, month, day } = nyParts(now);
  const [h, m] = hhmm.split(":").map(Number);
  return nyDate(year, month, day, h, m);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

// "3:05 PM" in Boston time.
export function formatNY(iso: string | Date): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
  });
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// Opening ranges for one day, as [openMin, closeMin] pairs. [] means closed.
// A specific day beats weekdays/weekend, which beat daily.
export function hoursForDay(hours: Record<string, string>, dayKey: string): [number, number][] {
  const isWeekend = dayKey === "sat" || dayKey === "sun";
  const text = hours[dayKey] ?? hours[isWeekend ? "weekend" : "weekdays"] ?? hours.daily ?? "closed";
  if (text === "closed") return [];
  return text.split(",").map((range) => {
    const [open, close] = range.trim().split("-");
    return [toMinutes(open), toMinutes(close)] as [number, number];
  });
}

// Open when you arrive AND still open when you'd be done (arrival + time spent).
export function isOpenFor(hours: Record<string, string>, arrive: Date, stayMin: number): boolean {
  const { dayKey, minutes } = nyParts(arrive);
  return hoursForDay(hours, dayKey).some(([open, close]) => minutes >= open && minutes + stayMin <= close);
}

export { DAY_KEYS };

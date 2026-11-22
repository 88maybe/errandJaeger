// Turns OpenStreetMap "opening_hours" text into our own hours format (see data/places.json _note).
// It understands the common forms only, e.g. "Mo-Fr 08:00-21:00; Sa 09:00-18:00; Su off" or "24/7".
// Anything fancier (dates, holidays only, sunrise, "+") returns null, and the app shows "hours unknown".

const DAYS = ["mo", "tu", "we", "th", "fr", "sa", "su"];
const OUR_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function parseDays(text: string): number[] | null {
  const out = new Set<number>();
  for (const part of text.split(",")) {
    const m = part.trim().toLowerCase().match(/^([a-z]{2})(?:-([a-z]{2}))?$/);
    if (!m) return null;
    const a = DAYS.indexOf(m[1]);
    const b = m[2] ? DAYS.indexOf(m[2]) : a;
    if (a < 0 || b < 0) return null;
    for (let i = a; ; i = (i + 1) % 7) {
      out.add(i);
      if (i === b) break;
    }
  }
  return [...out];
}

const toMin = (hhmm: string): number | null => {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59 || (h === 24 && min > 0)) return null;
  return h * 60 + min;
};

const fmt = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

// Returns ranges per day [open, close] in minutes, or null when it can't read the text.
function parseTimes(text: string): [number, number][] | null {
  const ranges: [number, number][] = [];
  for (const part of text.split(",")) {
    const m = part.trim().match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
    if (!m) return null;
    const open = toMin(m[1]);
    let close = toMin(m[2]);
    if (open === null || close === null) return null;
    if (close <= open) close += 1440; // past midnight, e.g. 18:00-02:00
    ranges.push([open, close]);
  }
  return ranges;
}

export function parseOsmHours(raw: string | undefined | null): Record<string, string> | null {
  if (!raw) return null;
  const text = raw.trim();
  if (text === "24/7") return { daily: "00:00-24:00" };

  const perDay: [number, number][][] = DAYS.map(() => []);
  let anything = false;
  for (const ruleRaw of text.split(";")) {
    const rule = ruleRaw.trim();
    if (!rule) continue;
    if (/^PH\b|^SH\b/i.test(rule)) continue; // holiday-only rules: ignore
    // Optional days, then times or off/closed.
    const D = "(?:Mo|Tu|We|Th|Fr|Sa|Su)";
    const m = rule.match(new RegExp(`^(${D}(?:\\s*-\\s*${D})?(?:\\s*,\\s*${D}(?:\\s*-\\s*${D})?)*)?\\s*(.*)$`, "i"));
    if (!m) return null;
    const dayText = (m[1] ?? "").replace(/\s+/g, "");
    let rest = m[2].trim();
    // "Mo-Fr,PH 09:00-17:00": drop the holiday part of the day list
    rest = rest.replace(/^,?\s*PH\b\s*/i, "");
    const days = dayText ? parseDays(dayText) : [0, 1, 2, 3, 4, 5, 6];
    if (!days) return null;
    if (/^(off|closed)$/i.test(rest)) {
      for (const d of days) perDay[d] = [];
      anything = true;
      continue;
    }
    if (rest === "24/7" || rest === "00:00-24:00") {
      for (const d of days) perDay[d] = [[0, 1440]];
      anything = true;
      continue;
    }
    const times = parseTimes(rest);
    if (!times) return null;
    for (const d of days) perDay[d] = times.map((t) => [...t] as [number, number]); // later rules replace earlier ones
    anything = true;
  }
  if (!anything) return null;

  // Ranges that run past midnight spill into the next morning.
  const final: [number, number][][] = DAYS.map(() => []);
  perDay.forEach((ranges, d) => {
    for (const [open, close] of ranges) {
      if (close <= 1440) final[d].push([open, close]);
      else {
        final[d].push([open, 1440]);
        final[(d + 1) % 7].push([0, close - 1440]);
      }
    }
  });

  const out: Record<string, string> = {};
  final.forEach((ranges, d) => {
    out[OUR_KEYS[d]] = ranges.length
      ? ranges
          .sort((a, b) => a[0] - b[0])
          .map(([a, b]) => `${fmt(a)}-${fmt(b)}`)
          .join(",")
      : "closed";
  });
  return out;
}

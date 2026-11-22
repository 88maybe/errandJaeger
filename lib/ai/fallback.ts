// The NON-AI way to read "Tell me what you need today". Simple keyword matching, runs in the browser.
// Used whenever the AI is unavailable, slow, or returns something that doesn't pass validation.
import { START_POINTS } from "../planner/places";
import type { Need } from "../planner/types";
import type { ParsedRequest } from "./validate";

const NEED_WORDS: [Need, RegExp][] = [
  ["grocery", /grocer|supermarket|food shop|trader joe|whole foods|shaw|star market|market/i],
  ["snack", /snack|coffee|cafe|café|bakery|pastry|treat|ice cream|lunch|bite|eat|tea\b/i],
  ["activity", /museum|library|park|garden|see |sightsee|visit|explore|stroll|wander|walk around|activity|something to do|church|gallery|browse/i],
  ["favorite", /favou?rite|usual|regular spot/i],
];

const START_ALIASES: [string, RegExp][] = [
  ["Kenmore Square", /kenmore/i],
  ["Copley Square", /copley/i],
  ["Prudential Center", /prudential|\bpru\b/i],
  ["Boston Common", /boston common|\bthe common\b/i],
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function findTime(text: string): string | null {
  if (/\bnoon\b/i.test(text)) return "12:00";
  const ampm = text.match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm|a\.m\.|p\.m\.)/i);
  if (ampm) {
    let hour = Number(ampm[1]) % 12;
    if (/p/i.test(ampm[3])) hour += 12;
    return `${pad(hour)}:${ampm[2] ?? "00"}`;
  }
  const h24 = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  return h24 ? `${pad(Number(h24[1]))}:${h24[2]}` : null;
}

export function basicParse(text: string): ParsedRequest {
  const needs = NEED_WORDS.filter(([, pattern]) => pattern.test(text)).map(([need]) => need);

  const startMatch = START_ALIASES.find(([name, pattern]) => pattern.test(text) && START_POINTS.some((p) => p.name === name));

  let loop: boolean | null = null;
  if (/one[- ]way|no loop|don'?t (need|have) to (come|go) back|not coming back/i.test(text)) loop = false;
  else if (/loop|come back|return|round trip|back home|back to (start|where)/i.test(text)) loop = true;

  const calm = /calm|gentle|low[- ]stim|overwhelm|tired|exhaust|easy|slow|sensory|quiet/i.test(text) ? true : null;

  return { needs, startTime: findTime(text), start: startMatch ? startMatch[0] : null, loop, calm };
}

export function hasAnything(p: ParsedRequest): boolean {
  return p.needs.length > 0 || p.startTime !== null || p.start !== null || p.loop !== null || p.calm !== null;
}

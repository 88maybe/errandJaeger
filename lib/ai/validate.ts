// Checks everything the AI sends back BEFORE the app uses it. Plain code, safe to run anywhere.
// Rule: the AI may reword or parse, but never invent. Anything that doesn't pass is thrown away.
import type { Need } from "../planner/types";

export const ALLOWED_NEEDS: Need[] = ["grocery", "snack", "activity", "favorite"];

export type ParsedRequest = {
  needs: Need[];
  startTime: string | null; // "HH:MM" Boston time
  start: string | null; // exactly one of the start point names
  loop: boolean | null; // null = the request didn't say
  calm: boolean | null;
};

export type StepFacts = { index: number; kind: "walk" | "stop"; place: string; text: string };

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

// ---- 1. "Tell me what you need today" ----
export function validateParsed(raw: unknown, startNames: string[]): ParsedRequest | null {
  if (!isObject(raw)) return null;
  const needs = Array.isArray(raw.needs)
    ? [...new Set(raw.needs.filter((n): n is Need => ALLOWED_NEEDS.includes(n as Need)))]
    : [];
  const startTime = typeof raw.startTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(raw.startTime) ? raw.startTime : null;
  const start = typeof raw.start === "string" && startNames.includes(raw.start) ? raw.start : null;
  return {
    needs,
    startTime,
    start,
    loop: typeof raw.loop === "boolean" ? raw.loop : null,
    calm: typeof raw.calm === "boolean" ? raw.calm : null,
  };
}

// ---- 2. Friendlier bingo square names ----
const includesName = (text: string, name: string) => text.toLowerCase().includes(name.toLowerCase());

// Keeps only labels that still contain the real place name. Returns { squareId: label }.
export function validateBingoLabels(raw: unknown, squares: { id: string; place: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  if (!isObject(raw) || !Array.isArray(raw.labels)) return out;
  for (const item of raw.labels) {
    if (!isObject(item) || typeof item.id !== "string" || typeof item.label !== "string") continue;
    const square = squares.find((s) => s.id === item.id);
    const label = item.label.trim();
    if (!square || label.length < 3 || label.length > 60) continue;
    if (!includesName(label, square.place)) continue; // must keep the real name
    out[square.id] = label;
  }
  return out;
}

// ---- 3. One simple action per calm-mode step ----
export const numbersIn = (text: string): string[] => text.match(/\d+/g) ?? [];
export const compassIn = (text: string): string[] =>
  text.toLowerCase().match(/\b(?:north-east|north-west|south-east|south-west|north|south|east|west)\b/g) ?? [];

// Keeps only actions that name the real place and add no new numbers or directions.
export function validateActions(raw: unknown, items: StepFacts[]): Record<number, string> {
  const out: Record<number, string> = {};
  if (!isObject(raw) || !Array.isArray(raw.steps)) return out;
  for (const entry of raw.steps) {
    if (!isObject(entry) || typeof entry.index !== "number" || typeof entry.action !== "string") continue;
    const item = items.find((i) => i.index === entry.index);
    const action = entry.action.trim();
    if (!item || action.length < 4 || action.length > 160) continue;
    if (!includesName(action, item.place)) continue;
    const knownNumbers = new Set(numbersIn(item.text));
    if (numbersIn(action).some((n) => !knownNumbers.has(n))) continue; // invented a time or number
    const knownDirections = new Set(compassIn(item.text));
    if (compassIn(action).some((d) => !knownDirections.has(d))) continue; // invented a direction
    out[item.index] = action;
  }
  return out;
}

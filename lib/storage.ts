// The ONE place the app saves and loads things.
// Today it uses the browser's localStorage. Later (M4) only this file changes to talk to a database.
// Every function is async on purpose, so swapping in a database will not change the pages.
import type { Square } from "./bingo";
import { KENMORE } from "./planner/places";
import type { Departures } from "./planner/schedule";
import type { Need, Point, RoutePlan } from "./planner/types";

// What the home form remembers between visits.
export type Prefs = {
  needs: Need[];
  loop: boolean;
  calm: boolean;
  start: Point;
};

// One outing: the plan, its bingo card, and how far you have got.
export type Outing = {
  id: string;
  createdAt: string; // ISO time
  mode: "normal" | "calm";
  plan: RoutePlan;
  card: Square[];
  ticked: number[]; // positions (0-8) of squares you have ticked
  step: number; // which step you are on in the one-step view
  finishedAt?: string; // set when you press "Finish outing"
  leftNow?: boolean; // started with "Leave now" (only then do ticks re-time the plan)
  train?: Departures; // the day's real scheduled trips for the rides in this plan (used to re-time without asking again)
  rev?: number; // goes up each time the plan is re-timed (so AI wording is made again)
  // What changed the last time the plan was re-timed, in plain words, plus stops that would now be closed.
  change?: { lines: string[]; dropIds: string[]; at: string };
  // Friendlier wording from the AI. Only ever rewords; every fact still comes from the planner.
  ai?: {
    bingo?: "done" | "failed";
    steps?: "done" | "failed";
    actions?: string[]; // one simple action per timeline item (same order as buildTimeline)
  };
};

const KEYS = {
  prefs: "errandjaeger:v1:prefs",
  outing: "errandjaeger:v1:outing", // the current, unfinished outing
  history: "errandjaeger:v1:history", // finished outings
};

const DEFAULT_PREFS: Prefs = { needs: [], loop: true, calm: false, start: KENMORE };

// Reads and parses a saved value. Any problem (private window, bad data) falls back quietly.
function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the app still works, it just won't remember.
  }
}

export async function getPrefs(): Promise<Prefs> {
  const saved = read<Partial<Prefs>>(KEYS.prefs, {});
  const start = saved.start && typeof saved.start.lat === "number" ? saved.start : DEFAULT_PREFS.start;
  return { ...DEFAULT_PREFS, ...saved, start };
}

export async function savePrefs(prefs: Prefs): Promise<void> {
  write(KEYS.prefs, prefs);
}

export async function getOuting(): Promise<Outing | null> {
  return read<Outing | null>(KEYS.outing, null);
}

export async function saveOuting(outing: Outing): Promise<void> {
  write(KEYS.outing, outing);
}

export async function getHistory(): Promise<Outing[]> {
  return read<Outing[]>(KEYS.history, []);
}

// Clears the current (unfinished) outing without counting it.
export async function discardOuting(): Promise<void> {
  try {
    window.localStorage.removeItem(KEYS.outing);
  } catch {
    // ignore
  }
}

// Marks the current outing as finished, moves it into history, and clears the current slot.
// An outing with nothing ticked does NOT count: it is cleared and null is returned.
export async function finishOuting(): Promise<Outing | null> {
  const current = await getOuting();
  if (!current) return null;
  if (current.ticked.length === 0) {
    await discardOuting();
    return null;
  }
  const finished: Outing = { ...current, finishedAt: new Date().toISOString() };
  write(KEYS.history, [...(await getHistory()), finished]);
  await discardOuting();
  return finished;
}

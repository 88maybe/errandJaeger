// The ONE place the app saves and loads things.
// Everything is kept in the browser (localStorage). If the server has a database (DATABASE_URL), finished
// outings are ALSO saved there under an anonymous device id, and read back and merged. Any database problem
// is ignored: the browser copy always works on its own.
import type { Square } from "./bingo";
import type { NearbyPlace } from "./nearby/types";
import { KENMORE } from "./planner/places";
import type { Departures } from "./planner/schedule";
import type { Need, Point, RoutePlan } from "./planner/types";

// What the home form remembers between visits.
export type Prefs = {
  needs: Need[];
  loop: boolean;
  calm: boolean;
  start: Point;
  stim?: boolean; // Stim mode: true = lively map and side quests, false = fewer markers, gentle fades
  radius?: number; // map search radius in metres
  includeAddOns?: boolean; // Stim mode off: also visit treats and wellbeing places (after the errands)
  bingo?: boolean; // make a bingo card for new trips (default yes)
};

// One place on your hitlist (tap a place on the map to add it). Errands are missions; the rest are add-ons.
export type HitItem = NearbyPlace;

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
  bingo?: boolean; // false = no bingo on this trip (missing = bingo on)
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
  favorites: "errandjaeger:v1:favorites", // starred places
  hitlist: "errandjaeger:v1:hitlist", // places picked on the map for the next plan
  device: "errandjaeger:v1:device", // anonymous random id, only used to find this browser's outings in the database
};

const DEFAULT_PREFS: Prefs = { needs: [], loop: true, calm: false, start: KENMORE, stim: false, radius: 1000, includeAddOns: true };

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

function localHistory(): Outing[] {
  return read<Outing[]>(KEYS.history, []);
}

// An anonymous id for this browser (random, no personal data).
export function deviceId(): string {
  let id = read<string | null>(KEYS.device, null);
  if (!id || typeof id !== "string") {
    id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : "00000000-0000-4000-8000-" + String(Date.now()).padStart(12, "0").slice(-12);
    write(KEYS.device, id);
  }
  return id;
}

async function pushOuting(outing: Outing): Promise<boolean> {
  try {
    const res = await fetch("/api/db/outings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: deviceId(), outing }),
      signal: AbortSignal.timeout(6000),
    });
    return !!(await res.json())?.ok;
  } catch {
    return false;
  }
}

// Finished outings: this browser's copy, merged with the database copy when there is one.
export async function getHistory(): Promise<Outing[]> {
  const local = localHistory();
  if (typeof window === "undefined") return local;
  try {
    const res = await fetch(`/api/db/outings?device=${deviceId()}`, { signal: AbortSignal.timeout(3500) });
    const data = await res.json();
    if (!data?.ok || !Array.isArray(data.outings)) return local; // no database, or it failed: browser copy only
    const remote = data.outings as Outing[];
    const ids = new Set(local.map((o) => o.id));
    const merged = [...local, ...remote.filter((o) => o && !ids.has(o.id))].sort(
      (a, b) => Date.parse(a.finishedAt ?? a.createdAt) - Date.parse(b.finishedAt ?? b.createdAt),
    );
    if (merged.length !== local.length) write(KEYS.history, merged);
    // Outings finished while the database was away: send them now (a few at a time).
    const remoteIds = new Set(remote.map((o) => o.id));
    for (const o of local.filter((x) => !remoteIds.has(x.id)).slice(0, 10)) void pushOuting(o);
    return merged;
  } catch {
    return local;
  }
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
// A bingo outing with nothing ticked does NOT count: it is cleared and null is returned.
// (A trip without bingo counts when you press "Finish outing".)
export async function finishOuting(): Promise<Outing | null> {
  const current = await getOuting();
  if (!current) return null;
  if (current.ticked.length === 0 && current.bingo !== false) {
    await discardOuting();
    return null;
  }
  const finished: Outing = { ...current, finishedAt: new Date().toISOString() };
  write(KEYS.history, [...localHistory(), finished]);
  await discardOuting();
  void pushOuting(finished); // also to the database, if there is one
  return finished;
}

// Starred places (saved in this browser only).
export async function getFavorites(): Promise<NearbyPlace[]> {
  const list = read<NearbyPlace[]>(KEYS.favorites, []);
  return Array.isArray(list) ? list.filter((p) => p && typeof p.id === "string" && typeof p.lat === "number") : [];
}

export async function saveFavorites(list: NearbyPlace[]): Promise<void> {
  write(KEYS.favorites, list.slice(0, 50));
}

export async function getHitlist(): Promise<HitItem[]> {
  const list = read<HitItem[]>(KEYS.hitlist, []);
  return Array.isArray(list) ? list.filter((p) => p && typeof p.id === "string" && typeof p.lat === "number") : [];
}

export async function saveHitlist(list: HitItem[]): Promise<void> {
  write(KEYS.hitlist, list);
}

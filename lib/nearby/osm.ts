// SERVER / SCRIPT ONLY. Asks OpenStreetMap's Overpass API, trying several public mirrors in turn.
// Short timeout per mirror, a mirror that just failed is skipped for a while, and the last one that worked goes first.
import { OUTSIDE_HEADERS } from "../http";
import type { Kind } from "./categories";
import { parseOsmHours } from "./hours";
import type { NearbyPlace } from "./types";

export const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
const MIRROR_REST_MS = 2 * 60_000; // skip a failed mirror for 2 minutes
const resting = new Map<string, number>(); // mirror -> when it failed
let lastGood: string | null = null;

export type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

// Runs one Overpass query. `budgetMs` caps the total time across mirrors. Null if every mirror failed.
export async function overpass(query: string, opts: { perMirrorMs?: number; budgetMs?: number } = {}): Promise<OsmElement[] | null> {
  const perMirror = opts.perMirrorMs ?? 4500;
  const deadline = Date.now() + (opts.budgetMs ?? 11_000);
  const order = [...(lastGood ? [lastGood] : []), ...OVERPASS_MIRRORS.filter((m) => m !== lastGood)];
  for (const mirror of order) {
    const left = deadline - Date.now();
    if (left < 800) break;
    if (Date.now() - (resting.get(mirror) ?? 0) < MIRROR_REST_MS) continue;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(perMirror, left));
    try {
      const res = await fetch(mirror, {
        method: "POST",
        headers: { ...OUTSIDE_HEADERS, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ data: query }),
        signal: controller.signal,
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { elements?: OsmElement[]; remark?: string };
      // A "remark" with a runtime error means the server gave up part-way: don't trust a partial answer.
      if (!Array.isArray(json.elements) || /runtime error/i.test(json.remark ?? "")) throw new Error("bad answer");
      lastGood = mirror;
      return json.elements;
    } catch {
      resting.set(mirror, Date.now());
      if (lastGood === mirror) lastGood = null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

// The query for one category, either around a point or inside a box (south, west, north, east).
export function kindQuery(kind: Kind, area: { around: [number, number, number] } | { bbox: [number, number, number, number] }, limit?: number): string {
  const where = "around" in area ? `(around:${area.around[2]},${area.around[0]},${area.around[1]})` : `(${area.bbox.join(",")})`;
  return `[out:json][timeout:25];(${kind.osm.map((f) => `nwr${f}${where};`).join("")});out center tags${limit ? ` ${limit}` : ""};`;
}

function nameFor(kind: Kind, tags: Record<string, string>): string | null {
  const name = tags.name ?? tags["name:en"];
  if (name) return name.slice(0, 80);
  if (kind.id === "bank" && tags.amenity === "atm") {
    const who = tags.operator ?? tags.brand;
    return (who ? `${who} ATM` : "ATM").slice(0, 80);
  }
  return null; // unnamed places are hard to find, so we leave them out
}

// Libraries: only ones anyone can walk into (public branches), not university, school, law or private ones.
const NOT_PUBLIC = /universit|college|school|academy|law|institute|hospital|seminary|athenaeum|archive|little free|society|club|church|private/i;
export function isPublicLibrary(name: string, tags: Record<string, string> = {}): boolean {
  if (tags.library === "public" || /public library|branch library|\bbpl\b/i.test(`${name} ${tags.operator ?? ""}`)) return true;
  if (tags.library && tags.library !== "public") return false; // academic, research, ...
  return !NOT_PUBLIC.test(`${name} ${tags.operator ?? ""}`);
}

// OSM elements -> our places (named, public, with a position). Duplicates (same name and spot) are dropped.
export function toNearby(kind: Kind, elements: OsmElement[]): NearbyPlace[] {
  const seen = new Set<string>();
  return elements.flatMap((el): NearbyPlace[] => {
    const tags = el.tags ?? {};
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    const name = nameFor(kind, tags);
    if (typeof lat !== "number" || typeof lng !== "number" || !name) return [];
    if (tags.access === "private" || tags.access === "no") return [];
    if (kind.id === "library" && !isPublicLibrary(name, tags)) return [];
    const key = `${name}|${lat.toFixed(4)}|${lng.toFixed(4)}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [
      {
        id: `osm-${el.type}-${el.id}`,
        name,
        kind: kind.id,
        lat: Math.round(lat * 1e6) / 1e6,
        lng: Math.round(lng * 1e6) / 1e6,
        hours: parseOsmHours(tags.opening_hours),
        hoursVerified: false,
        source: "osm",
      },
    ];
  });
}

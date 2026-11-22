import data from "@/data/places.json";
import { rateLimited } from "@/lib/ai/guard";
import { inArea, kindById, RADII, roundCoord, type Kind } from "@/lib/nearby/categories";
import { parseOsmHours } from "@/lib/nearby/hours";
import type { NearbyPlace, NearbyResponse } from "@/lib/nearby/types";
import { distanceMeters } from "@/lib/planner/geo";
import type { Place } from "@/lib/planner/types";

// Nearby places from OpenStreetMap (Overpass API). SERVER ONLY.
// The browser only ever sends coordinates rounded to about 100 m. Results are cached by that rounded spot,
// every call has a timeout, and if OpenStreetMap can't be reached we answer from our own list (data/places.json).

const ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter"];
const TIMEOUTS_MS = [7000, 4000];
const CACHE_TTL_MS = 30 * 60_000; // places don't move
const FAIL_TTL_MS = 60_000; // after a failure, don't ask OpenStreetMap again for a minute
const MAX_RESULTS = 60;
const USER_AGENT = "errandJaeger/0.1 (BostonHacks hackathon project)";

const cache = new Map<string, { at: number; value: NearbyPlace[] }>();
let failedAt = 0;

type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

function nameFor(kind: Kind, tags: Record<string, string>): string | null {
  const name = tags.name ?? tags["name:en"];
  if (name) return name.slice(0, 80);
  if (kind.id === "bank" && tags.amenity === "atm") return `${tags.operator ?? tags.brand ?? "ATM"}${tags.operator || tags.brand ? " ATM" : ""}`.slice(0, 80);
  return null; // unnamed places are hard to find, so we leave them out
}

async function fromOverpass(kind: Kind, lat: number, lng: number, radius: number): Promise<NearbyPlace[] | null> {
  const query = `[out:json][timeout:8];(${kind.osm.map((f) => `nwr${f}(around:${radius},${lat},${lng});`).join("")});out center tags ${MAX_RESULTS * 2};`;
  for (let i = 0; i < ENDPOINTS.length; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUTS_MS[i]);
    try {
      const res = await fetch(ENDPOINTS[i], {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT, Accept: "application/json" },
        body: new URLSearchParams({ data: query }),
        signal: controller.signal,
        cache: "no-store",
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { elements?: OsmElement[] };
      if (!Array.isArray(json.elements)) continue;
      const seen = new Set<string>();
      return json.elements.flatMap((el): NearbyPlace[] => {
        const tags = el.tags ?? {};
        const plat = el.lat ?? el.center?.lat;
        const plng = el.lon ?? el.center?.lon;
        const name = nameFor(kind, tags);
        if (typeof plat !== "number" || typeof plng !== "number" || !name) return [];
        if (tags.access === "private" || tags.access === "no") return [];
        const key = `${name}|${plat.toFixed(4)}|${plng.toFixed(4)}`;
        if (seen.has(key)) return [];
        seen.add(key);
        return [{ id: `osm-${el.type}-${el.id}`, name, kind: kind.id, lat: plat, lng: plng, hours: parseOsmHours(tags.opening_hours), hoursVerified: false, source: "osm" }];
      });
    } catch {
      // timeout or network problem: try the next server
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

function fromOurList(kind: Kind, lat: number, lng: number, radius: number): NearbyPlace[] {
  const places = data.places as unknown as Place[];
  return places
    .filter((p) => kind.fallbackIds.includes(p.id) && distanceMeters({ lat, lng }, p) <= radius + 300)
    .map((p) => ({ id: p.id, name: p.name, kind: kind.id, lat: p.lat, lng: p.lng, hours: p.hours, hoursVerified: p.hoursVerified, source: "list" as const }));
}

export async function GET(request: Request) {
  if (rateLimited(request)) return Response.json({ ok: false, source: "list", places: [], reason: "rate-limited" }, { status: 429 });
  const url = new URL(request.url);
  const kind = kindById(url.searchParams.get("cat") ?? "");
  const lat = roundCoord(Number(url.searchParams.get("lat")));
  const lng = roundCoord(Number(url.searchParams.get("lng")));
  const asked = Number(url.searchParams.get("r"));
  const radius = RADII.includes(asked) ? asked : 1000;
  if (!kind || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Response.json({ ok: false, source: "list", places: [], reason: "bad-request" } satisfies NearbyResponse, { status: 400 });
  }
  if (!inArea({ lat, lng })) {
    return Response.json({ ok: false, source: "list", places: [], reason: "outside-area" } satisfies NearbyResponse, { status: 400 });
  }

  const key = `${kind.id}:${lat}:${lng}:${radius}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return Response.json({ ok: true, source: "osm", places: hit.value } satisfies NearbyResponse);

  // Ask a little wider than the radius, because the browser measures from your real (unrounded) spot.
  const tryOsm = Date.now() - failedAt > FAIL_TTL_MS;
  const osm = tryOsm ? await fromOverpass(kind, lat, lng, radius + 150) : null;
  if (osm) {
    const sorted = osm.sort((a, b) => distanceMeters({ lat, lng }, a) - distanceMeters({ lat, lng }, b)).slice(0, MAX_RESULTS);
    cache.set(key, { at: Date.now(), value: sorted });
    if (cache.size > 300) cache.clear(); // keep memory small
    return Response.json({ ok: true, source: "osm", places: sorted } satisfies NearbyResponse);
  }
  if (tryOsm) failedAt = Date.now();
  return Response.json({ ok: true, source: "list", places: fromOurList(kind, lat, lng, radius) } satisfies NearbyResponse);
}

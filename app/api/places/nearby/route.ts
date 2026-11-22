import data from "@/data/places.json";
import snapshot from "@/data/osm-snapshot.json";
import { rateLimited } from "@/lib/ai/guard";
import { inArea, kindById, RADII, roundCoord, type Kind } from "@/lib/nearby/categories";
import { isPublicLibrary, kindQuery, overpass, toNearby } from "@/lib/nearby/osm";
import type { NearbyPlace, NearbyResponse } from "@/lib/nearby/types";
import { distanceMeters } from "@/lib/planner/geo";
import type { Place } from "@/lib/planner/types";

// Nearby places from OpenStreetMap (Overpass API, several mirrors). SERVER ONLY.
// The browser only ever sends coordinates rounded to about 100 m. Results are cached by that rounded spot.
// If no mirror answers: the saved OpenStreetMap snapshot (data/osm-snapshot.json), then our own small list.

const CACHE_TTL_MS = 30 * 60_000; // places don't move
const FAIL_TTL_MS = 60_000; // after every mirror failed, use the fallbacks for a minute without asking again
const MAX_RESULTS = 30; // per category and search

const cache = new Map<string, { at: number; value: NearbyPlace[] }>();
let failedAt = 0;

const near = (lat: number, lng: number, radius: number) => (p: { lat: number; lng: number }) => distanceMeters({ lat, lng }, p) <= radius;
const byDistance = (lat: number, lng: number) => (a: NearbyPlace, b: NearbyPlace) => distanceMeters({ lat, lng }, a) - distanceMeters({ lat, lng }, b);

function fromSnapshot(kind: Kind, lat: number, lng: number, radius: number): NearbyPlace[] {
  const places = (snapshot.places ?? []) as NearbyPlace[];
  return places
    .filter((p) => p.kind === kind.id && near(lat, lng, radius)(p) && (kind.id !== "library" || isPublicLibrary(p.name)))
    .map((p) => ({ ...p, source: "snapshot" as const }))
    .sort(byDistance(lat, lng))
    .slice(0, MAX_RESULTS);
}

function fromOurList(kind: Kind, lat: number, lng: number, radius: number): NearbyPlace[] {
  const places = data.places as unknown as Place[];
  return places
    .filter((p) => kind.fallbackIds.includes(p.id) && near(lat, lng, radius + 300)(p))
    .map((p) => ({ id: p.id, name: p.name, kind: kind.id, lat: p.lat, lng: p.lng, hours: p.hours, hoursVerified: p.hoursVerified, source: "list" as const }));
}

export async function GET(request: Request) {
  if (rateLimited(request)) return Response.json({ ok: false, source: "list", places: [], reason: "rate-limited" } satisfies NearbyResponse, { status: 429 });
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
  const elements = tryOsm ? await overpass(kindQuery(kind, { around: [lat, lng, radius + 150] }, MAX_RESULTS * 3)) : null;
  if (elements) {
    const places = toNearby(kind, elements).sort(byDistance(lat, lng)).slice(0, MAX_RESULTS);
    cache.set(key, { at: Date.now(), value: places });
    if (cache.size > 300) cache.clear(); // keep memory small
    return Response.json({ ok: true, source: "osm", places } satisfies NearbyResponse);
  }
  if (tryOsm) failedAt = Date.now();

  const saved = fromSnapshot(kind, lat, lng, radius + 150);
  if (saved.length > 0) return Response.json({ ok: true, source: "snapshot", places: saved } satisfies NearbyResponse);
  return Response.json({ ok: true, source: "list", places: fromOurList(kind, lat, lng, radius) } satisfies NearbyResponse);
}

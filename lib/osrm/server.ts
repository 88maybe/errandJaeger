// SERVER ONLY. OSRM routing (walking and driving) with several public servers, short timeouts and a cache.
import { OUTSIDE_HEADERS } from "../http";
import type { OsrmRoute, OsrmStep } from "./types";

const MIRRORS: Record<"foot" | "car", string[]> = {
  foot: ["https://routing.openstreetmap.de/routed-foot/route/v1/foot"],
  car: ["https://router.project-osrm.org/route/v1/driving", "https://routing.openstreetmap.de/routed-car/route/v1/driving"],
};
const TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 30 * 60_000;
const MIRROR_REST_MS = 2 * 60_000;
const WALK_M_PER_MIN = 80; // the app's walking pace everywhere
const cache = new Map<string, { at: number; value: OsrmRoute }>();
const resting = new Map<string, number>();

type Maneuver = { type: string; modifier?: string; bearing_after?: number };
type RawStep = { name: string; distance: number; maneuver: Maneuver };
type Raw = { code: string; routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] }; legs: { steps: RawStep[] }[] }[] };

const COMPASS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
const onto = (name: string) => (name ? ` onto ${name}` : "");

function stepText(s: RawStep): string | null {
  const m = s.maneuver;
  const mod = m.modifier ?? "";
  switch (m.type) {
    case "depart":
      return `Head ${COMPASS[Math.round((m.bearing_after ?? 0) / 45) % 8]}${s.name ? ` on ${s.name}` : ""}`;
    case "arrive":
      return null; // the screen says where you arrive
    case "roundabout":
    case "rotary":
      return `Go around the roundabout${onto(s.name)}`;
    case "new name":
    case "continue":
      return mod === "uturn" ? `Turn around${onto(s.name)}` : `Continue${onto(s.name)}`;
    default:
      // turn, end of road, fork, merge, on/off ramp
      if (!mod || mod === "straight") return `Continue straight${onto(s.name)}`;
      if (mod === "uturn") return `Turn around${onto(s.name)}`;
      return `${mod.startsWith("slight") ? "Bear" : "Turn"} ${mod.replace("slight ", "").replace("sharp ", "sharp ")}${onto(s.name)}`;
  }
}

export async function osrmRoute(profile: "foot" | "car", from: [number, number], to: [number, number]): Promise<OsrmRoute | null> {
  const coords = `${from[1]},${from[0]};${to[1]},${to[0]}`; // OSRM wants lng,lat
  const key = `${profile}:${coords}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  for (const base of MIRRORS[profile]) {
    if (Date.now() - (resting.get(base) ?? 0) < MIRROR_REST_MS) continue;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const url = `${base}/${coords}?overview=full&geometries=geojson&steps=${profile === "foot" ? "true" : "false"}`;
      const res = await fetch(url, { headers: OUTSIDE_HEADERS, signal: controller.signal, cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = (await res.json()) as Raw;
      const r = raw.routes?.[0];
      if (raw.code !== "Ok" || !r) throw new Error(raw.code);
      const steps: OsrmStep[] = r.legs
        .flatMap((l) => l.steps)
        .flatMap((s) => {
          const text = stepText(s);
          return text ? [{ text, distanceM: Math.round(s.distance) }] : [];
        });
      // Drop tiny steps (a few metres across a plaza or kerb), so the list stays short and readable.
      const kept = steps.filter((s) => s.distanceM >= 10);
      const short = kept.length > 0 ? kept : steps;
      const value: OsrmRoute = {
        ok: true,
        profile,
        distanceM: Math.round(r.distance),
        durationMin: Math.max(1, Math.ceil(profile === "foot" ? r.distance / WALK_M_PER_MIN : r.duration / 60)),
        geometry: r.geometry.coordinates.map(([x, y]) => [Math.round(x * 1e5) / 1e5, Math.round(y * 1e5) / 1e5]),
        steps: short,
      };
      cache.set(key, { at: Date.now(), value });
      if (cache.size > 500) cache.clear();
      return value;
    } catch {
      resting.set(base, Date.now());
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

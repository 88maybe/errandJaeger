// Browser side of the map search. Your exact location stays here: only rounded coordinates go to our server.
import { kindById, roundCoord, type Group, type KindId } from "./categories";
import type { NearbyPlace, NearbyResponse } from "./types";
import { distanceMeters, walkMinutes } from "../planner/geo";
import { closingText, isOpenFor } from "../planner/time";
import type { Place } from "../planner/types";
import { nearestStation } from "../transit";

export type Found = NearbyPlace & { distanceM: number; walkMin: number };

export async function fetchNearby(kind: KindId, at: { lat: number; lng: number }, radius: number): Promise<NearbyResponse | null> {
  const params = new URLSearchParams({ cat: kind, lat: String(roundCoord(at.lat)), lng: String(roundCoord(at.lng)), r: String(radius) });
  try {
    const res = await fetch(`/api/places/nearby?${params}`, { signal: AbortSignal.timeout(14000) });
    const json = (await res.json()) as NearbyResponse;
    return json && Array.isArray(json.places) ? json : null;
  } catch {
    return null;
  }
}

// Distance and walking time from your real spot (worked out here, in the browser).
export function measure(places: NearbyPlace[], from: { lat: number; lng: number }, radius: number): Found[] {
  return places
    .map((p) => ({ ...p, distanceM: distanceMeters(from, p), walkMin: walkMinutes(from, p) }))
    .filter((p) => p.distanceM <= radius)
    .sort((a, b) => a.distanceM - b.distanceM);
}

export const groupOf = (p: { kind: KindId }): Group => kindById(p.kind)?.group ?? "treats";
export const isMission = (p: { kind: KindId }) => groupOf(p) === "errands";

export function distanceText(m: number): string {
  return m < 950 ? `${Math.max(50, Math.round(m / 50) * 50)} m` : `${(m / 1000).toFixed(1)} km`;
}

// "Open, closes 9 PM" / "Closed now" / "Hours unknown".
export function openStatus(p: NearbyPlace, now: Date): { text: string; tone: "open" | "closed" | "unknown" } {
  if (!p.hours) return { text: "Hours unknown", tone: "unknown" };
  if (!isOpenFor(p.hours, now, 0)) return { text: "Closed now", tone: "closed" };
  const closes = closingText(p.hours, now);
  return { text: closes && closes !== "midnight" ? `Open, closes ${closes}` : "Open now", tone: "open" };
}

// A map place -> a planner place. The nearest station is worked out from the coordinates.
export function toPlace(p: NearbyPlace): Place {
  const kind = kindById(p.kind);
  return {
    id: p.id,
    name: p.name,
    category: kind?.category ?? "activity",
    tags: [],
    area: "",
    lat: p.lat,
    lng: p.lng,
    nearestStop: nearestStation(p).name,
    hours: p.hours ?? {},
    hoursUnknown: !p.hours,
    hoursVerified: p.hoursVerified,
    kind: p.kind,
    dwellMin: kind?.dwellMin,
  };
}

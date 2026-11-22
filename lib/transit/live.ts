// Live MBTA predictions (browser side). Calls OUR server route, never the MBTA directly.
// Everything here is display-only: it never changes the saved plan. If live data fails, the schedule is shown.
import type { RoutePlan, TransitLeg } from "../planner/types";
import { transitLegs } from "./client";

export type LivePrediction = {
  trip: string | null;
  dep: string | null; // ISO, or null when the MBTA has no time yet
  status: string | null; // e.g. "Boarding"
  relationship: string | null; // e.g. "CANCELLED", "SKIPPED"
};
export type LiveResponse = { ok: true; predictions: Record<string, LivePrediction[]> };

export const liveKey = (l: { stationId: string; routeIds: string[]; directionId: number }) =>
  `${l.stationId}|${l.routeIds.join(",")}|${l.directionId}`;

export async function fetchLive(plan: RoutePlan, timeoutMs = 7000): Promise<LiveResponse | null> {
  const legs = transitLegs(plan).map((l) => ({ stationId: l.stationId, routeIds: l.routeIds, directionId: l.directionId }));
  if (legs.length === 0) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch("/api/transit/live", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ legs }),
      signal: controller.signal,
    });
    const data = await res.json();
    return res.ok && data?.ok ? (data as LiveResponse) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// What we can say about one upcoming train right now.
export type LiveInfo = {
  legStart: string; // the plan leg this is about (its startTime)
  predictedDep: string | null; // ISO, null when the MBTA gave no time
  minutesAway: number | null;
  delayMin: number | null; // vs the scheduled time of the same trip (positive = late)
  status: string | null; // plain words: "Boarding", "Cancelled", ...
  headline: string; // "Train in 6 min" or the status when there is no time
  plannedTrainLeft: boolean; // the train we planned you onto has already left (earlier than scheduled)
};

const STATUS_WORDS: Record<string, string> = { CANCELLED: "Cancelled", SKIPPED: "This stop is skipped", NO_DATA: "No live data" };

// `servingTrips` = ids of scheduled trips that stop at BOTH the boarding and the get-off station (from the saved schedule).
// A prediction counts only if it is our planned trip, or a trip in that set. Same route and direction are already
// guaranteed by the request. Otherwise we return null and the screen shows the scheduled time.
export function liveInfoFor(
  leg: TransitLeg,
  predictions: LivePrediction[] | undefined,
  now: Date,
  servingTrips: Set<string> | null,
): LiveInfo | null {
  if (!predictions || predictions.length === 0) return null;
  const usable = (p: LivePrediction) => !!p.trip && (p.trip === leg.tripId || !!servingTrips?.has(p.trip));
  predictions = predictions.filter(usable);
  if (predictions.length === 0) return null;
  const scheduled = leg.departAt ? new Date(leg.departAt) : null;
  // Prefer the very trip we planned. Otherwise the next train that hasn't left yet.
  const mine = leg.tripId ? predictions.find((p) => p.trip === leg.tripId) : undefined;
  const upcoming = predictions.find((p) => p.dep && new Date(p.dep).getTime() >= now.getTime() - 30_000);
  const mineLeft = !!mine?.dep && new Date(mine.dep).getTime() < now.getTime() - 30_000;
  const pick = mine && !mineLeft ? mine : upcoming;
  if (!pick) return null;
  const sameTrip = pick === mine;

  const words = pick.relationship ? STATUS_WORDS[pick.relationship] ?? pick.relationship : pick.status;
  if (!pick.dep) {
    return { legStart: leg.startTime, predictedDep: null, minutesAway: null, delayMin: null, status: words, headline: words ?? "No live time yet", plannedTrainLeft: mineLeft };
  }
  const dep = new Date(pick.dep);
  const minutesAway = Math.max(0, Math.ceil((dep.getTime() - now.getTime()) / 60000));
  const delayMin = scheduled && sameTrip ? Math.round((dep.getTime() - scheduled.getTime()) / 60000) : null;
  return {
    legStart: leg.startTime,
    predictedDep: pick.dep,
    minutesAway,
    delayMin,
    status: words,
    plannedTrainLeft: mineLeft,
    headline: words === "Cancelled" ? "Cancelled" : minutesAway === 0 ? "Train arriving now" : `Train in ${minutesAway} min`,
  };
}

export function delayText(info: LiveInfo): string | null {
  if (info.status && info.status !== "Boarding" && info.status !== "On time") return info.status;
  if (info.delayMin === null) return info.status;
  if (info.delayMin >= 2) return `${info.delayMin} min late`;
  if (info.delayMin <= -2) return `${Math.abs(info.delayMin)} min early`;
  return "On time";
}

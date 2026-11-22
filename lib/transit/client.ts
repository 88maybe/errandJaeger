// Browser side: asks OUR server route for real MBTA schedule data and alerts. Never calls the MBTA directly.
import type { PlanAlert, RoutePlan, TransitLeg } from "../planner/types";

export type CheckLeg = { stationId: string; toStationId: string; routeIds: string[]; directionId: 0 | 1 };
// One scheduled trip that serves BOTH the boarding and the get-off station.
export type TripTime = { trip: string; dep: string; arr: string };
export type CheckResponse = {
  ok: true;
  departures: Record<string, TripTime[]>; // key -> trips sorted by departure (a missing key means that lookup failed)
  alerts: PlanAlert[] | null; // null = the alerts lookup failed
};

export const legKey = (l: CheckLeg) => `${l.stationId}>${l.toStationId}|${l.routeIds.join(",")}|${l.directionId}`;
export const transitLegs = (plan: RoutePlan): TransitLeg[] => plan.legs.filter((l): l is TransitLeg => l.type === "transit");

// The MBTA "service day" runs until about 3 AM, so a 1 AM train belongs to the day before.
export function serviceDate(whenIso: string): string {
  const shifted = new Date(new Date(whenIso).getTime() - 3 * 3600_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(shifted);
}

// Returns null on ANY problem (timeout, server error, bad data). The caller then keeps the estimates.
export async function fetchTrainData(plan: RoutePlan, timeoutMs = 9000): Promise<CheckResponse | null> {
  const legs = transitLegs(plan).map((l) => ({ stationId: l.stationId, toStationId: l.toStationId, routeIds: l.routeIds, directionId: l.directionId }));
  if (legs.length === 0) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch("/api/transit/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: serviceDate(plan.leaveBy), legs }),
      signal: controller.signal,
    });
    const data = await res.json();
    return res.ok && data?.ok && data.departures ? (data as CheckResponse) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

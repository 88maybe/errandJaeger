// Ways to get from A to B right now: transit options (fastest, and fewest changes), with real schedules applied.
// Plain code, no AI. Every walk and ride time is an ESTIMATE unless it comes from the MBTA schedule or live data.
import { distanceMeters, walkMinutes } from "../planner/geo";
import { MAX_WALK_NORMAL, transitTripVia } from "../planner";
import { addMinutes } from "../planner/time";
import type { Point, RoutePlan, TransitLeg } from "../planner/types";
import { STATIONS } from "../transit/data";
import type { TripTime } from "../transit/client";

const STATION_CANDIDATES = 4; // try this many nearby stations at each end

export type TransitOption = {
  key: string; // the same rides -> the same key
  tags: string[]; // "Fastest", "Fewest changes"
  plan: RoutePlan; // legs only (no stops); times are estimates until the schedule is applied
  changes: number;
};

const transitOf = (plan: RoutePlan) => plan.legs.filter((l): l is TransitLeg => l.type === "transit");

export function miniPlan(from: Point, to: Point, legs: RoutePlan["legs"], clock: Date, minutes: number): RoutePlan {
  return {
    start: from,
    leaveBy: clock.toISOString(),
    backBy: null,
    endTime: addMinutes(clock, minutes).toISOString(),
    totalMin: minutes,
    stops: [],
    legs,
    skipped: [],
    warnings: [],
  };
}

function nearbyStations(p: Point) {
  return [...STATIONS]
    .sort((a, b) => distanceMeters(p, a) - distanceMeters(p, b))
    .filter((s) => walkMinutes(p, s) <= MAX_WALK_NORMAL)
    .slice(0, STATION_CANDIDATES);
}

export function findTransitOptions(from: Point, to: Point, clock: Date): TransitOption[] {
  const found: { key: string; plan: RoutePlan; minutes: number; changes: number }[] = [];
  for (const board of nearbyStations(from)) {
    for (const alight of nearbyStations(to)) {
      for (const mode of ["normal", "calm"] as const) {
        const trip = transitTripVia(from, to, clock, MAX_WALK_NORMAL, mode, board, alight);
        if (!trip) continue;
        const rides = trip.legs.filter((l): l is TransitLeg => l.type === "transit");
        if (rides.length === 0) continue;
        const key = rides.map((r) => `${r.stationId}>${r.toStationId}:${r.routeIds.join(",")}`).join("|");
        if (found.some((f) => f.key === key)) continue;
        found.push({ key, plan: miniPlan(from, to, trip.legs, clock, trip.minutes), minutes: trip.minutes, changes: rides.length - 1 });
      }
    }
  }
  if (found.length === 0) return [];
  const fastest = [...found].sort((a, b) => a.minutes - b.minutes || a.changes - b.changes)[0];
  const fewest = [...found].sort((a, b) => a.changes - b.changes || a.minutes - b.minutes)[0];
  if (fewest.key === fastest.key) return [{ ...fastest, tags: ["Fastest", "Fewest changes"] }];
  return [
    { ...fastest, tags: ["Fastest"] },
    { ...fewest, tags: ["Fewest changes"] },
  ];
}

export type Summary = {
  leaveAt: Date; // when to leave so you don't wait long on the platform
  arriveAt: Date;
  totalMin: number;
  walkMin: number;
  waitMin: number;
  rideMin: number;
  basis: "scheduled" | "estimate";
};

export function summarize(plan: RoutePlan): Summary {
  const rides = transitOf(plan);
  const first = rides[0];
  const firstIndex = first ? plan.legs.indexOf(first) : plan.legs.length;
  const walkBefore = plan.legs.slice(0, firstIndex).reduce((n, l) => n + l.durationMin, 0);
  const start = new Date(plan.leaveBy);
  // With a real departure time, leave just in time to walk there. Otherwise leave now.
  const leaveAt = first?.departAt ? new Date(Math.max(start.getTime(), new Date(first.departAt).getTime() - walkBefore * 60000)) : start;
  const arriveAt = new Date(plan.endTime);
  const walkMin = plan.legs.filter((l) => l.type === "walk").reduce((n, l) => n + l.durationMin, 0);
  const rideMin = rides.reduce((n, r) => n + (r.departAt && r.arriveAt ? Math.round((new Date(r.arriveAt).getTime() - new Date(r.departAt).getTime()) / 60000) : r.rideMin), 0);
  const totalMin = Math.max(1, Math.round((arriveAt.getTime() - leaveAt.getTime()) / 60000));
  return {
    leaveAt,
    arriveAt,
    totalMin,
    walkMin,
    rideMin,
    waitMin: Math.max(0, totalMin - walkMin - rideMin),
    basis: rides.length > 0 && rides.every((r) => r.departBasis === "scheduled") ? "scheduled" : "estimate",
  };
}

// The next scheduled trains for a ride that you can still catch (the planned one first).
export function nextTrips(leg: TransitLeg, trips: TripTime[] | undefined, count = 2): TripTime[] {
  if (!trips) return [];
  const from = new Date(leg.departAt ?? leg.startTime).getTime() - 30_000;
  return trips.filter((t) => new Date(t.dep).getTime() >= from).slice(0, count);
}

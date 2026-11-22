// The planner. Plain code, no AI: it only uses the real place list and simple maths.
import { compassDirection, walkMinutes } from "./geo";
import { KENMORE } from "./places";
import { addMinutes, isOpenFor } from "./time";
import { findRoute, lineLabel, nearestStation, rideLines, transferNote } from "../transit";
import type { Leg, Need, Place, PlanInput, Point, RoutePlan, Stop } from "./types";

// ESTIMATES of how long you spend at each kind of stop, in minutes.
const DWELL_MIN: Record<string, number> = { grocery: 20, snack: 15, activity: 40 };

// Longest single walk we allow (also the longest walk to or from a station).
const MAX_WALK_NORMAL = 25;
const MAX_WALK_CALM = 15; // calmer = shorter walks

// A walk longer than this (minutes, estimate) is replaced by transit when transit is quicker.
const TRANSIT_ABOVE_WALK_MIN = 12;
// Calmer mode takes transit for a long walk even if it is a little slower (up to this many minutes).
const CALM_TRANSIT_SLACK_MIN = 5;

// Does this place satisfy this need? "favorite" matches the tag, others match the category.
function matches(place: Place, need: Need): boolean {
  return need === "favorite" ? place.tags.includes("favorite") : place.category === need;
}

// ---- Getting from one place to the next ----
type Trip = { legs: Leg[]; minutes: number }; // minutes = the whole trip, waits included (ESTIMATE)

function walkLeg(from: Point, to: Point, toName: string, clock: Date, minutes: number, suffix = ""): Leg {
  return {
    type: "walk",
    from: from.name,
    to: toName,
    startTime: clock.toISOString(),
    durationMin: minutes,
    instruction: `Head ${compassDirection(from, to)}. About ${minutes} min walk${suffix} (estimate).`,
  };
}

// The plain walk. Null if it is longer than we allow. No leg at all when you are already there.
function walkTrip(from: Point, to: Point, clock: Date, maxWalk: number): Trip | null {
  const minutes = walkMinutes(from, to);
  if (minutes > maxWalk) return null;
  return { legs: minutes > 0 ? [walkLeg(from, to, to.name, clock, minutes)] : [], minutes };
}

// Walk to the nearest station, ride, then walk to the destination. Null if that is not possible.
function transitTrip(from: Point, to: Point, clock: Date, maxWalk: number, mode: "normal" | "calm"): Trip | null {
  const board = nearestStation(from);
  const alight = nearestStation(to);
  if (board.id === alight.id) return null;
  const walkIn = walkMinutes(from, board);
  const walkOut = walkMinutes(alight, to);
  if (walkIn > maxWalk || walkOut > maxWalk) return null;
  const route = findRoute(board.id, alight.id, mode);
  if (!route) return null;

  const legs: Leg[] = [];
  let t = clock;
  if (walkIn > 0) {
    legs.push(walkLeg(from, board, `${board.name} station`, t, walkIn));
    t = addMinutes(t, walkIn);
  }
  for (const ride of route.rides) {
    // Walking outside from the last station to the next one (no ride in between).
    if (ride.walkLinkFrom) {
      legs.push({
        type: "walk",
        from: `${ride.walkLinkFrom.name} station`,
        to: `${ride.from.name} station`,
        startTime: t.toISOString(),
        durationMin: ride.walkLinkMin,
        instruction: `Walk to ${ride.from.name} station, heading ${compassDirection(ride.walkLinkFrom, ride.from)}. About ${ride.walkLinkMin} min walk (estimate).`,
      });
      t = addMinutes(t, ride.walkLinkMin);
    }
    const duration = ride.waitMin + ride.rideMin;
    const parts = {
      changeFrom: ride.changeFrom?.name ?? null,
      lineLabel: lineLabel(ride),
      boardAt: ride.from.name,
      platform: ride.platform,
      toward: ride.toward,
      stops: ride.stops,
      rideMin: ride.rideMin,
      getOffAt: ride.to.name,
      waitMin: ride.waitMin,
      departText: null,
    };
    const lines = rideLines(parts);
    legs.push({
      type: "transit",
      from: ride.from.name,
      to: ride.to.name,
      startTime: t.toISOString(),
      durationMin: duration,
      instruction: lines.join(" "),
      lineLabel: parts.lineLabel,
      boardAt: parts.boardAt,
      platform: parts.platform,
      toward: parts.toward,
      stops: parts.stops,
      getOffAt: parts.getOffAt,
      waitMin: parts.waitMin,
      rideMin: parts.rideMin,
      changeFrom: parts.changeFrom,
      transferNote: transferNote(ride),
      lines,
      stationId: ride.from.id,
      toStationId: ride.to.id,
      routeIds: ride.sameWay.map((l) => l.routeId),
      directionId: ride.directionId,
    });
    t = addMinutes(t, duration);
  }
  if (walkOut > 0) legs.push(walkLeg(alight, to, to.name, t, walkOut, " from the station"));
  return { legs, minutes: walkIn + route.totalMin + walkOut };
}

// Pick walking or transit for one trip.
// Walks of 12 minutes or less stay walks. Longer walks use transit when it is quicker
// (calmer mode: also when it is up to 5 minutes slower, to keep the walking short).
export function chooseTrip(from: Point, to: Point, clock: Date, maxWalk: number, mode: "normal" | "calm"): Trip | null {
  const walk = walkTrip(from, to, clock, maxWalk);
  if (walk && walkMinutes(from, to) <= TRANSIT_ABOVE_WALK_MIN) return walk;
  const transit = transitTrip(from, to, clock, maxWalk, mode);
  if (!transit) return walk;
  if (!walk) return transit;
  const slack = mode === "calm" ? CALM_TRANSIT_SLACK_MIN : 0;
  return transit.minutes <= walk.minutes + slack && (mode === "calm" || transit.minutes < walk.minutes) ? transit : walk;
}

export function planRoute(input: PlanInput, places: Place[]): RoutePlan {
  const start = input.start ?? KENMORE;
  const mode = input.mode ?? "normal";
  const maxWalk = input.mode === "calm" ? MAX_WALK_CALM : MAX_WALK_NORMAL;

  let here = { name: start.name, lat: start.lat, lng: start.lng };
  let clock = input.startTime;

  const remaining: Need[] = [...new Set(input.needs)]; // each need once
  const stops: Stop[] = [];
  const legs: Leg[] = [];
  const used = new Set<string>(); // don't visit the same place twice

  // Keep picking the NEAREST open place that fits any remaining need.
  while (remaining.length > 0) {
    let best: { need: Need; place: Place; trip: Trip; arrive: Date; dwell: number } | null = null;

    for (const need of remaining) {
      for (const place of places) {
        if (used.has(place.id) || !matches(place, need)) continue;

        const trip = chooseTrip(here, place, clock, maxWalk, mode);
        if (!trip) continue; // can't get there sensibly

        const arrive = addMinutes(clock, trip.minutes);
        const dwell = DWELL_MIN[place.category];
        if (!isOpenFor(place.hours, arrive, dwell)) continue; // closed (Boston time)

        if (!best || trip.minutes < best.trip.minutes) best = { need, place, trip, arrive, dwell };
      }
    }

    if (!best) break; // nothing left is reachable and open

    legs.push(...best.trip.legs); // walk, or walk + ride(s) + walk
    const leaveAt = addMinutes(best.arrive, best.dwell);
    stops.push({
      need: best.need,
      place: best.place,
      arriveAt: best.arrive.toISOString(),
      leaveAt: leaveAt.toISOString(),
      dwellMin: best.dwell,
    });

    used.add(best.place.id);
    remaining.splice(remaining.indexOf(best.need), 1);
    here = { name: best.place.name, lat: best.place.lat, lng: best.place.lng };
    clock = leaveAt;
  }

  // Anything still in "remaining" could not be fitted in.
  const skipped = remaining.map((need) => ({
    need,
    reason: "Nothing open and reachable from the previous stop at that time.",
  }));

  // Walk back to the start if the user wants a loop.
  const warnings: string[] = [];
  let backBy: string | null = null;
  if (input.loop && stops.length > 0) {
    const trip = chooseTrip(here, start, clock, maxWalk, mode);
    if (trip) {
      legs.push(...trip.legs);
      clock = addMinutes(clock, trip.minutes);
    } else {
      // No good way back: show the walk anyway and say so.
      const back = walkMinutes(here, start);
      legs.push(walkLeg(here, start, start.name, clock, back, " back"));
      clock = addMinutes(clock, back);
      warnings.push(`The walk back is about ${back} min (estimate), longer than we like.`);
    }
    backBy = clock.toISOString();
  }

  for (const s of stops) {
    if (!s.place.hoursVerified) warnings.push(`Opening hours for ${s.place.name} are not verified.`);
  }

  return {
    start,
    leaveBy: input.startTime.toISOString(),
    backBy,
    endTime: clock.toISOString(),
    totalMin: Math.round((clock.getTime() - input.startTime.getTime()) / 60000),
    stops,
    legs,
    skipped,
    warnings,
  };
}

// For re-planning: the best way (walk, or train) between two points at a given time.
export function tripBetween(from: Point, to: Point, clock: Date, mode: "normal" | "calm") {
  return chooseTrip(from, to, clock, mode === "calm" ? MAX_WALK_CALM : MAX_WALK_NORMAL, mode);
}

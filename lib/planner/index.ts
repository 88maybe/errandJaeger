// The planner. Plain code, no AI: it only uses the real place list and simple maths.
import { compassDirection, walkMinutes } from "./geo";
import { KENMORE } from "./places";
import { addMinutes, isOpenFor } from "./time";
import type { Leg, Need, Place, PlanInput, RoutePlan, Stop } from "./types";

// ESTIMATES of how long you spend at each kind of stop, in minutes.
const DWELL_MIN: Record<string, number> = { grocery: 20, snack: 15, activity: 40 };

// Longest single walk we allow until transit arrives in M3a.
const MAX_WALK_NORMAL = 25;
const MAX_WALK_CALM = 15; // calmer = shorter walks

// Does this place satisfy this need? "favorite" matches the tag, others match the category.
function matches(place: Place, need: Need): boolean {
  return need === "favorite" ? place.tags.includes("favorite") : place.category === need;
}

export function planRoute(input: PlanInput, places: Place[]): RoutePlan {
  const start = input.start ?? KENMORE;
  const maxWalk = input.mode === "calm" ? MAX_WALK_CALM : MAX_WALK_NORMAL;

  let here = { name: start.name, lat: start.lat, lng: start.lng };
  let clock = input.startTime;

  const remaining: Need[] = [...new Set(input.needs)]; // each need once
  const stops: Stop[] = [];
  const legs: Leg[] = [];
  const used = new Set<string>(); // don't visit the same place twice

  // Keep picking the NEAREST open place that fits any remaining need.
  while (remaining.length > 0) {
    let best: { need: Need; place: Place; walk: number; arrive: Date; dwell: number } | null = null;

    for (const need of remaining) {
      for (const place of places) {
        if (used.has(place.id) || !matches(place, need)) continue;

        const walk = walkMinutes(here, place);
        if (walk > maxWalk) continue; // too far from the previous stop

        const arrive = addMinutes(clock, walk);
        const dwell = DWELL_MIN[place.category];
        if (!isOpenFor(place.hours, arrive, dwell)) continue; // closed (Boston time)

        if (!best || walk < best.walk) best = { need, place, walk, arrive, dwell };
      }
    }

    if (!best) break; // nothing left is reachable and open

    // A walk of 0 minutes means you are already there, so no walking leg is needed.
    if (best.walk > 0) {
      legs.push({
        type: "walk",
        from: here.name,
        to: best.place.name,
        startTime: clock.toISOString(),
        durationMin: best.walk,
        instruction: `Head ${compassDirection(here, best.place)}. About ${best.walk} min walk (estimate).`,
      });
    }
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
    reason: `Nothing open within a ${maxWalk}-minute walk of the previous stop at that time.`,
  }));

  // Walk back to the start if the user wants a loop.
  const warnings: string[] = [];
  let backBy: string | null = null;
  if (input.loop && stops.length > 0) {
    const back = walkMinutes(here, start);
    legs.push({
      type: "walk",
      from: here.name,
      to: start.name,
      startTime: clock.toISOString(),
      durationMin: back,
      instruction: `Head ${compassDirection(here, start)}. About ${back} min walk back (estimate).`,
    });
    clock = addMinutes(clock, back);
    backBy = clock.toISOString();
    if (back > maxWalk) {
      warnings.push(`The walk back is about ${back} min. Transit for the way home arrives in a later step.`);
    }
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

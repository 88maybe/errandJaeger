// Turns a RoutePlan into ONE list in time order: walk, stop, walk, stop...
// Also picks the kind message to show when a plan is empty or partly empty.
import { addMinutes, nyParts } from "./time";
import type { Need, RoutePlan } from "./types";

export type TimelineItem = {
  kind: "walk" | "stop";
  title: string; // e.g. "Walk to Trader Joe's" or "Trader Joe's"
  detail: string; // e.g. "Head north-east. About 9 min (estimate)."
  startTime: string; // ISO
  endTime: string; // ISO
};

// Friendly names for each need.
export const NEED_LABEL: Record<Need, string> = {
  grocery: "Groceries",
  snack: "A snack",
  activity: "Something to do",
  favorite: "A favorite spot",
};

export function buildTimeline(plan: RoutePlan): TimelineItem[] {
  const items: TimelineItem[] = [];

  // Each walking leg becomes a "walk" item. Its end = start + its minutes.
  for (const leg of plan.legs) {
    items.push({
      kind: "walk",
      title: `Walk to ${leg.to}`,
      detail: leg.instruction,
      startTime: leg.startTime,
      endTime: addMinutes(new Date(leg.startTime), leg.durationMin).toISOString(),
    });
  }

  // Each stop becomes a "stop" item from arriving to leaving.
  for (const stop of plan.stops) {
    items.push({
      kind: "stop",
      title: stop.place.name,
      detail: `${NEED_LABEL[stop.need]}. About ${stop.dwellMin} min here (estimate).`,
      startTime: stop.arriveAt,
      endTime: stop.leaveAt,
    });
  }

  // Put everything in time order. If two items start at the same moment, the walk comes first.
  return items.sort((a, b) => {
    const diff = new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    if (diff !== 0) return diff;
    return a.kind === b.kind ? 0 : a.kind === "walk" ? -1 : 1;
  });
}

// A kind message when there is no plan at all, or null when there is one.
export function emptyPlanMessage(plan: RoutePlan): string | null {
  if (plan.stops.length > 0) return null;
  const startHour = Math.floor(nyParts(new Date(plan.leaveBy)).minutes / 60); // Boston time
  return startHour >= 19
    ? "Nothing's open that late nearby. Try an earlier start."
    : "We couldn't fit those in nearby. Try fewer things or a different start time.";
}

// A soft note when some (but not all) needs didn't fit, or null.
export function skippedNote(plan: RoutePlan): string | null {
  if (plan.stops.length === 0 || plan.skipped.length === 0) return null;
  const names = plan.skipped.map((s) => NEED_LABEL[s.need].toLowerCase()).join(", ");
  return `Couldn't fit: ${names}. Try another time.`;
}

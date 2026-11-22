// Turns a RoutePlan into ONE list in time order: walk, stop, walk, stop...
// Also picks the kind message to show when a plan is empty or partly empty.
import { addMinutes, formatNY, nyParts } from "./time";
import type { Basis, Need, RoutePlan, TransitLeg } from "./types";

export type TimelineItem = {
  kind: "walk" | "stop" | "transit";
  title: string; // e.g. "Walk to Trader Joe's" or "Trader Joe's"
  place: string; // the real place this item is about (the walk's destination, or the stop itself)
  detail: string; // e.g. "Head north-east. About 9 min (estimate)."
  startTime: string; // ISO
  endTime: string; // ISO
  lines?: string[]; // transit only: the facts as short sentences, one per line on screen
  basis: Basis; // where this item's time comes from (shown as a chip)
  warning?: string; // loud last-train warning for this item (shown on screen, never reworded by AI)
  keep?: string[]; // words the AI must keep if it rewords this item (transit facts)
};

// Friendly names for each need.
export const NEED_LABEL: Record<Need, string> = {
  grocery: "Groceries",
  snack: "A snack",
  activity: "Something to do",
  errand: "An errand",
  favorite: "A favorite spot",
};

// The facts about a ride that a reworded step must still contain.
const transitKeep = (leg: TransitLeg) => [leg.platform, ...leg.toward, leg.getOffAt];

// The same plan as ONE-ACTION steps for the calmer step-by-step view.
// Walks and stops are one step each. A ride is split in two: "board" and "ride, then get off".
export function buildSteps(plan: RoutePlan): TimelineItem[] {
  const steps: TimelineItem[] = [];
  const legs = new Map(plan.legs.map((l) => [l.startTime, l]));
  for (const item of buildTimeline(plan)) {
    const leg = item.kind === "transit" ? legs.get(item.startTime) : undefined;
    if (!leg || leg.type !== "transit") {
      steps.push(item);
      continue;
    }
    const boardEnd = addMinutes(new Date(leg.startTime), leg.waitMin).toISOString();
    const toward = leg.toward.length > 1 ? `${leg.toward.slice(0, -1).join(", ")} or ${leg.toward[leg.toward.length - 1]}` : leg.toward[0];
    steps.push({
      kind: "transit",
      title: leg.transferNote ?? `Board at ${leg.boardAt}`,
      place: leg.boardAt,
      detail: `Go to the platform "${leg.platform}" at ${leg.boardAt}. Wait for the ${leg.lineLabel} toward ${toward}. ${
        leg.departAt ? `Next train leaves at ${formatNY(leg.departAt)} (scheduled).` : `About ${leg.waitMin} min wait (estimate).`
      }`,
      warning: leg.lastWarning ?? undefined,
      startTime: leg.startTime,
      endTime: boardEnd,
      basis: leg.departBasis ?? "estimate",
      keep: [leg.platform, ...leg.toward],
    });
    steps.push({
      kind: "transit",
      title: `Ride ${leg.stops} ${leg.stops === 1 ? "stop" : "stops"}`,
      place: leg.getOffAt,
      detail: `Ride ${leg.stops} ${leg.stops === 1 ? "stop" : "stops"}, then get off at ${leg.getOffAt}. ${
        leg.arriveAt ? `Arrives at ${formatNY(leg.arriveAt)} (scheduled).` : `About ${leg.rideMin} min (estimate).`
      }`,
      startTime: boardEnd,
      endTime: item.endTime,
      basis: leg.arriveBasis ?? "estimate",
      keep: [String(leg.stops), leg.getOffAt],
    });
  }
  return steps;
}

export function buildTimeline(plan: RoutePlan): TimelineItem[] {
  const items: TimelineItem[] = [];

  // Each walking leg becomes a "walk" item. Its end = start + its minutes.
  for (const leg of plan.legs) {
    const endTime = addMinutes(new Date(leg.startTime), leg.durationMin).toISOString();
    if (leg.type === "transit") {
      items.push({
        kind: "transit",
        title: `Take the ${leg.lineLabel} to ${leg.getOffAt}`,
        place: leg.getOffAt,
        detail: leg.instruction,
        startTime: leg.startTime,
        endTime,
        lines: leg.lines,
        basis: leg.departBasis ?? "estimate",
        warning: leg.lastWarning ?? undefined,
        keep: transitKeep(leg),
      });
    } else {
      items.push({
        kind: "walk",
        title: `Walk to ${leg.to}`,
        place: leg.to,
        detail: leg.instruction,
        startTime: leg.startTime,
        endTime,
        basis: "estimate",
      });
    }
  }

  // Each stop becomes a "stop" item from arriving to leaving.
  for (const stop of plan.stops) {
    items.push({
      kind: "stop",
      title: stop.place.name,
      place: stop.place.name,
      detail: `${NEED_LABEL[stop.need]}. About ${stop.dwellMin} min here (estimate).`,
      startTime: stop.arriveAt,
      endTime: stop.leaveAt,
      basis: "estimate",
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
  const names = plan.skipped.map((s) => s.name ?? NEED_LABEL[s.need].toLowerCase()).join(", ");
  return `Couldn't fit: ${names}. Try another time.`;
}

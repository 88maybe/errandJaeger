// Puts REAL MBTA schedule data into a plan. Plain code, no AI.
// 1. The flat "about 5 min wait" becomes the next SCHEDULED departure at or after you reach the platform.
// 2. Every later time in the plan moves with it.
// 3. If you'd board within 45 minutes of the day's last train (or after it), we add a loud warning.
import { CHANGE_WALK_MIN } from "../transit/route";
import { rideLines, towardText } from "../transit/text";
import { legKey, type CheckResponse } from "../transit/client";
import { addMinutes, formatNY, isOpenFor } from "./time";
import type { Leg, RoutePlan, Stop, TransitLeg } from "./types";

export const LAST_TRAIN_WINDOW_MIN = 45;

type Event = { leg: Leg } | { stop: Stop };
const startOf = (e: Event) => new Date("leg" in e ? e.leg.startTime : e.stop.arriveAt).getTime();

export function applyTrainData(plan: RoutePlan, data: CheckResponse | null): RoutePlan {
  if (!plan.legs.some((l) => l.type === "transit")) return { ...plan, trainCheck: "none", trainWarnings: [], alerts: [] };
  if (!data) return { ...plan, trainCheck: "failed", trainWarnings: [], alerts: [] };

  // The plan in time order (a leg comes before a stop that starts at the same moment).
  const events: Event[] = [...plan.legs.map((leg) => ({ leg })), ...plan.stops.map((stop) => ({ stop }))].sort(
    (a, b) => startOf(a) - startOf(b) || ("leg" in a ? -1 : 1),
  );

  let cursor = new Date(plan.leaveBy);
  const legs: Leg[] = [];
  const stops: Stop[] = [];
  const warnings = [...plan.warnings];
  const trainWarnings: string[] = [];
  let allFound = true;

  for (const event of events) {
    if ("stop" in event) {
      const s = event.stop;
      const leaveAt = addMinutes(cursor, s.dwellMin);
      if (isOpenFor(s.place.hours, new Date(s.arriveAt), s.dwellMin) && !isOpenFor(s.place.hours, cursor, s.dwellMin)) {
        warnings.push(`${s.place.name} may be closed by the time you get there, because of the train times.`);
      }
      stops.push({ ...s, arriveAt: cursor.toISOString(), leaveAt: leaveAt.toISOString() });
      cursor = leaveAt;
      continue;
    }

    const leg = event.leg;
    if (leg.type === "walk") {
      legs.push({ ...leg, startTime: cursor.toISOString() });
      cursor = addMinutes(cursor, leg.durationMin);
      continue;
    }

    // A train ride.
    const departures = data.departures[legKey(leg)];
    const reach = addMinutes(cursor, leg.changeFrom ? CHANGE_WALK_MIN : 0); // when you'd be on the platform
    let next: Date | null = null;
    let last: Date | null = null;
    if (!departures) {
      allFound = false; // this lookup failed: keep the estimate
    } else {
      const times = departures.map((t) => new Date(t));
      next = times.find((t) => t.getTime() >= reach.getTime()) ?? null;
      last = times.length > 0 ? times[times.length - 1] : null;
    }

    const waitMin = next ? Math.round((next.getTime() - cursor.getTime()) / 60000) : leg.waitMin;
    const next2: TransitLeg = {
      ...leg,
      startTime: cursor.toISOString(),
      waitMin,
      durationMin: waitMin + leg.rideMin,
      departAt: next?.toISOString(),
      lastDeparture: last?.toISOString() ?? null,
      lastWarning: null,
    };
    next2.lines = rideLines({
      changeFrom: leg.changeFrom,
      lineLabel: leg.lineLabel,
      boardAt: leg.boardAt,
      platform: leg.platform,
      toward: leg.toward,
      stops: leg.stops,
      rideMin: leg.rideMin,
      getOffAt: leg.getOffAt,
      waitMin,
      departText: next ? formatNY(next) : null,
    });
    next2.instruction = next2.lines.join(" ");

    // Last-train warning: real schedule times only.
    if (departures && last) {
      const missed = !next;
      const close = next ? last.getTime() - next.getTime() <= LAST_TRAIN_WINDOW_MIN * 60000 : false;
      if (missed || close) {
        const text = `Last ${leg.lineLabel} train from ${leg.boardAt} toward ${towardText(leg.toward)} ${missed ? "left" : "leaves"} at ${formatNY(last)}.${
          missed ? " There may be no train for this ride." : ""
        }`;
        next2.lastWarning = text;
        if (!trainWarnings.includes(text)) trainWarnings.push(text);
      }
    } else if (departures && departures.length === 0) {
      allFound = false; // nothing scheduled that day at this stop
    }

    legs.push(next2);
    cursor = addMinutes(cursor, next2.durationMin);
  }

  return {
    ...plan,
    legs,
    stops,
    warnings,
    endTime: cursor.toISOString(),
    backBy: plan.backBy ? cursor.toISOString() : null,
    totalMin: Math.round((cursor.getTime() - new Date(plan.leaveBy).getTime()) / 60000),
    trainCheck: allFound && data.alerts !== null ? "ok" : "partial",
    trainWarnings,
    alerts: data.alerts ?? [],
  };
}

// Puts REAL MBTA schedule data into a plan, and re-times a plan when you are late or tick a stop. Plain code, no AI.
//  1. Waiting becomes "the next scheduled train you can still catch", and ride time becomes the real scheduled arrival.
//  2. Everything after a train moves with it.
//  3. If you'd board within 45 minutes of the day's last train (or after it), we add a loud warning.
import { CHANGE_WALK_MIN } from "../transit/route";
import { rideLines, towardText } from "../transit/text";
import { legKey, type CheckResponse, type TripTime } from "../transit/client";
import { addMinutes, closingText, formatNY, placeOpenFor } from "./time";
import type { Leg, RoutePlan, Stop, TransitLeg } from "./types";

export const LAST_TRAIN_WINDOW_MIN = 45;
export type Departures = Record<string, TripTime[]>;

export type Event = { leg: Leg } | { stop: Stop };
const startOf = (e: Event) => new Date("leg" in e ? e.leg.startTime : e.stop.arriveAt).getTime();
const endOf = (e: Event) =>
  "leg" in e ? new Date(e.leg.startTime).getTime() + e.leg.durationMin * 60000 : new Date(e.stop.leaveAt).getTime();

// The plan as one list in time order (a leg comes before a stop that starts at the same moment).
export function orderedEvents(plan: RoutePlan): Event[] {
  return [...plan.legs.map((leg) => ({ leg })), ...plan.stops.map((stop) => ({ stop }))].sort(
    (a, b) => startOf(a) - startOf(b) || ("leg" in a ? -1 : 1),
  );
}
export { endOf as eventEnd, startOf as eventStart };

export type RetimeOptions = {
  fromIndex?: number; // events before this index are kept exactly as they are
  cursor?: Date; // when the first re-timed event can start
  missedFirstTrain?: boolean; // the first train ride that is re-timed was missed: take the one after it
  events?: Event[]; // use this order instead of sorting by time (used after dropping a stop)
};

export type Retimed = {
  plan: RoutePlan;
  changes: string[]; // plain-words list of what moved
  closed: string[]; // place ids that would be closed by the time you get there
  allFound: boolean; // every train lookup had real data
};

const minutesLabel = (n: number) => `${Math.abs(n)} min ${n > 0 ? "later" : "earlier"}`;

export function retimePlan(plan: RoutePlan, departures: Departures | null, opts: RetimeOptions = {}): Retimed {
  const events = opts.events ?? orderedEvents(plan);
  const from = Math.min(Math.max(opts.fromIndex ?? 0, 0), events.length);
  let cursor = opts.cursor ?? new Date(plan.leaveBy);

  const legs: Leg[] = [];
  const stops: Stop[] = [];
  const trainWarnings: string[] = [];
  const changes: string[] = [];
  const closed: string[] = [];
  let allFound = true;
  let missedPending = !!opts.missedFirstTrain;
  let reportedTrain = false;

  events.forEach((event, index) => {
    // Already done: keep as it was (but still count its train warning).
    if (index < from) {
      if ("leg" in event) {
        legs.push(event.leg);
        if (event.leg.type === "transit" && event.leg.lastWarning) trainWarnings.push(event.leg.lastWarning);
      } else stops.push(event.stop);
      return;
    }

    if ("stop" in event) {
      const s = event.stop;
      const leaveAt = addMinutes(cursor, s.dwellMin);
      const open = placeOpenFor(s.place, cursor, s.dwellMin);
      const moved = Math.round((cursor.getTime() - new Date(s.arriveAt).getTime()) / 60000) !== 0;
      if (!open) {
        closed.push(s.place.id);
        if (moved) changes.push(`${s.place.name} will be closed by then. Drop it?`);
      } else if (moved) {
        // Mention the closing time only when it is close enough to matter (within 90 minutes of leaving).
        const closes = closingText(s.place.hours, cursor);
        if (closes && closes !== "midnight") {
          const [h, m] = parseClose(closes);
          const gap = h * 60 + m - minutesOfDay(leaveAt);
          if (gap >= 0 && gap <= 90) changes.push(`${s.place.name} closes at ${closes}, still OK.`);
        }
      }
      stops.push({ ...s, arriveAt: cursor.toISOString(), leaveAt: leaveAt.toISOString() });
      cursor = leaveAt;
      return;
    }

    const leg = event.leg;
    if (leg.type === "walk") {
      legs.push({ ...leg, startTime: cursor.toISOString() });
      cursor = addMinutes(cursor, leg.durationMin);
      return;
    }

    // A train ride.
    const trips = departures?.[legKey(leg)];
    const reach = addMinutes(cursor, leg.changeFrom ? CHANGE_WALK_MIN : 0); // when you'd be on the platform
    const oldDepart = leg.departAt ? new Date(leg.departAt) : addMinutes(new Date(leg.startTime), leg.waitMin);
    let candidates = (trips ?? []).filter((t) => new Date(t.dep).getTime() >= reach.getTime());
    if (missedPending) {
      candidates = candidates.filter((t) => new Date(t.dep).getTime() > oldDepart.getTime());
      missedPending = false;
    }
    const pick = candidates[0];
    const last = trips && trips.length > 0 ? new Date(trips[trips.length - 1].dep) : null;
    if (!trips || trips.length === 0) allFound = false;

    let nextLeg: TransitLeg;
    if (pick) {
      const dep = new Date(pick.dep);
      const arr = new Date(pick.arr);
      const waitMin = Math.round((dep.getTime() - cursor.getTime()) / 60000);
      const rideMin = Math.max(1, Math.round((arr.getTime() - dep.getTime()) / 60000));
      nextLeg = {
        ...leg,
        startTime: cursor.toISOString(),
        waitMin,
        rideMin,
        durationMin: Math.max(1, Math.round((arr.getTime() - cursor.getTime()) / 60000)),
        tripId: pick.trip,
        departAt: dep.toISOString(),
        arriveAt: arr.toISOString(),
        departBasis: "scheduled",
        arriveBasis: "scheduled",
      };
    } else {
      // No real data (lookup failed, or no train left): keep our estimates and say so.
      nextLeg = {
        ...leg,
        startTime: cursor.toISOString(),
        durationMin: leg.waitMin + leg.rideMin,
        tripId: undefined,
        departAt: undefined,
        arriveAt: undefined,
        departBasis: "estimate",
        arriveBasis: "estimate",
      };
    }
    nextLeg.lastDeparture = last?.toISOString() ?? null;
    nextLeg.lastWarning = null;
    nextLeg.lines = rideLines({
      changeFrom: leg.changeFrom,
      lineLabel: leg.lineLabel,
      boardAt: leg.boardAt,
      platform: leg.platform,
      toward: leg.toward,
      stops: leg.stops,
      rideMin: nextLeg.rideMin,
      getOffAt: leg.getOffAt,
      waitMin: nextLeg.waitMin,
      departText: nextLeg.departAt ? formatNY(nextLeg.departAt) : null,
      arriveText: nextLeg.arriveAt ? formatNY(nextLeg.arriveAt) : null,
    });
    nextLeg.instruction = nextLeg.lines.join(" ");

    // Last-train warning: real schedule times only.
    if (trips && last) {
      const missed = !pick;
      const close = pick ? last.getTime() - new Date(pick.dep).getTime() <= LAST_TRAIN_WINDOW_MIN * 60000 : false;
      if (missed || close) {
        const text = `Last ${leg.lineLabel} train from ${leg.boardAt} toward ${towardText(leg.toward)} ${missed ? "left" : "leaves"} at ${formatNY(last)}.${
          missed ? " There may be no train for this ride." : ""
        }`;
        nextLeg.lastWarning = text;
        if (!trainWarnings.includes(text)) trainWarnings.push(text);
      }
    }

    // What changed, in plain words (first train only, to keep it short).
    if (!reportedTrain && pick && opts.cursor) {
      const diff = Math.round((new Date(pick.dep).getTime() - oldDepart.getTime()) / 60000);
      if (diff !== 0) {
        changes.push(`Next train from ${leg.boardAt} is ${formatNY(pick.dep)} (scheduled), ${minutesLabel(diff)}.`);
        reportedTrain = true;
      }
    } else if (!reportedTrain && !pick && opts.cursor) {
      changes.push(`No more scheduled trains from ${leg.boardAt} for this ride.`);
      reportedTrain = true;
    }

    legs.push(nextLeg);
    cursor = addMinutes(new Date(nextLeg.startTime), nextLeg.durationMin);
  });

  const out: RoutePlan = {
    ...plan,
    legs,
    stops,
    endTime: cursor.toISOString(),
    backBy: plan.backBy ? cursor.toISOString() : null,
    totalMin: Math.round((cursor.getTime() - new Date(plan.leaveBy).getTime()) / 60000),
    trainWarnings,
  };
  if (opts.cursor && plan.backBy && out.backBy !== plan.backBy) {
    changes.push(`Back by ${formatNY(out.backBy!)} (was ${formatNY(plan.backBy)}).`);
  } else if (opts.cursor && !plan.backBy && out.endTime !== plan.endTime) {
    changes.push(`Done about ${formatNY(out.endTime)} (was ${formatNY(plan.endTime)}).`);
  }
  return { plan: out, changes, closed, allFound };
}

function parseClose(text: string): [number, number] {
  const m = text.match(/^(\d+)(?::(\d+))? (AM|PM)$/);
  if (!m) return [0, 0];
  const h = Number(m[1]) % 12;
  return [m[3] === "PM" ? h + 12 : h, Number(m[2] ?? 0)];
}
function minutesOfDay(d: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(d);
  return Number(parts.find((p) => p.type === "hour")!.value) * 60 + Number(parts.find((p) => p.type === "minute")!.value);
}

// First check right after the plan is made: real times for every ride, plus alerts.
export function applyTrainData(plan: RoutePlan, data: CheckResponse | null): RoutePlan {
  if (!plan.legs.some((l) => l.type === "transit")) return { ...plan, trainCheck: "none", trainWarnings: [], alerts: [] };
  if (!data) {
    // Keep the estimates, and mark every ride time as an estimate.
    const legs = plan.legs.map((l): Leg => (l.type === "transit" ? { ...l, departBasis: "estimate", arriveBasis: "estimate" } : l));
    return { ...plan, legs, trainCheck: "failed", trainWarnings: [], alerts: [] };
  }
  const r = retimePlan(plan, data.departures);
  const warnings = [...plan.warnings];
  for (const id of r.closed) {
    const name = plan.stops.find((s) => s.place.id === id)?.place.name;
    if (name) warnings.push(`${name} may be closed by the time you get there, because of the train times.`);
  }
  return {
    ...r.plan,
    warnings,
    trainCheck: r.allFound && data.alerts !== null ? "ok" : "partial",
    alerts: data.alerts ?? [],
  };
}

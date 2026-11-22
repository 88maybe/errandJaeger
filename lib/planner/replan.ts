// "I'm running late", "I missed it", "Replan from here" and "Drop this stop". Plain code, no AI.
// They never invent times: trains come from the saved real schedule (or fall back to our estimates).
import { distanceMeters } from "./geo";
import { tripBetween } from "./index";
import { PLACES } from "./places";
import { type Event, eventEnd, eventStart, orderedEvents, retimePlan, type Departures, type Retimed } from "./schedule";
import { STATIONS } from "../transit/data";
import { addMinutes } from "./time";
import type { Leg, Point, RoutePlan, Stop } from "./types";

export type Replanned = Retimed & { note?: string };

// How many events have already started at `now` (they stay as they were).
function startedCount(plan: RoutePlan, now: Date): number {
  return orderedEvents(plan).filter((e) => eventStart(e) <= now.getTime()).length;
}

// "I'm running late by N minutes": everything not started yet moves later, and trains are re-picked.
export function runningLate(plan: RoutePlan, departures: Departures | null, now: Date, lateMin: number): Replanned {
  const events = orderedEvents(plan);
  const from = startedCount(plan, now);
  const baseEnd = from > 0 ? eventEnd(events[from - 1]) : new Date(plan.leaveBy).getTime();
  const cursor = addMinutes(new Date(Math.max(now.getTime(), baseEnd)), lateMin);
  return retimePlan(plan, departures, { fromIndex: from, cursor });
}

// "I missed it": skip the next train and take the one after it.
export function missedTrain(plan: RoutePlan, departures: Departures | null, now: Date): Replanned {
  const events = orderedEvents(plan);
  const index = events.findIndex(
    (e) => "leg" in e && e.leg.type === "transit" && eventStart(e) + e.leg.waitMin * 60000 >= now.getTime() - 60_000,
  );
  if (index < 0) return { ...retimePlan(plan, departures), note: "There is no train ahead in your plan." };
  const cursor = new Date(Math.max(now.getTime(), eventStart(events[index])));
  return retimePlan(plan, departures, { fromIndex: index, cursor, missedFirstTrain: true });
}

// You ticked a stop: re-time everything after it from this moment.
export function replanFromTick(plan: RoutePlan, departures: Departures | null, placeId: string, now: Date): Replanned | null {
  const stop = plan.stops.find((s) => s.place.id === placeId);
  if (!stop) return null;
  const events = orderedEvents(plan);
  const index = events.findIndex((e) => "stop" in e && e.stop.place.id === placeId);
  if (index < 0 || index === events.length - 1) return null; // nothing after it to re-time
  const planned = new Date(stop.leaveAt).getTime();
  if (Math.abs(now.getTime() - planned) < 2 * 60_000) return null; // close enough to the plan

  // The stop now ends when you ticked it (never before you got there, so the order of the plan stays right).
  const leaveAt = new Date(Math.max(now.getTime(), new Date(stop.arriveAt).getTime()));
  const edited: RoutePlan = {
    ...plan,
    stops: plan.stops.map((s) => (s.place.id === placeId ? { ...s, leaveAt: leaveAt.toISOString() } : s)),
  };
  return retimePlan(edited, departures, { fromIndex: index + 1, cursor: leaveAt });
}

// ---- Dropping a stop ----
function pointByName(plan: RoutePlan, name: string): Point | null {
  if (name === plan.start.name) return plan.start;
  const place = PLACES.find((p) => p.name === name);
  if (place) return place;
  const station = STATIONS.find((s) => `${s.name} station` === name || s.name === name);
  return station ? { name: station.name, lat: station.lat, lng: station.lng } : null;
}

// Removes a stop and joins its neighbours with a fresh walk or train trip (estimates until train times are checked).
// Returns the new plan and the index (in time order) from which it must be re-timed.
export function dropStop(plan: RoutePlan, placeId: string, now: Date, mode: "normal" | "calm"): { plan: RoutePlan; fromIndex: number; cursor: Date; events: Event[] } | null {
  const events = orderedEvents(plan);
  const si = events.findIndex((e) => "stop" in e && e.stop.place.id === placeId);
  if (si < 0) return null;

  let a = si - 1; // previous stop (or -1 = the start)
  while (a >= 0 && "leg" in events[a]) a--;
  let b = si + 1; // next stop (or the end)
  while (b < events.length && "leg" in events[b]) b++;

  const prevPoint: Point = a >= 0 && "stop" in events[a] ? (events[a] as { stop: Stop }).stop.place : plan.start;
  const nextEvent = b < events.length ? events[b] : null;
  const nextPoint: Point | null = nextEvent && "stop" in nextEvent ? nextEvent.stop.place : plan.backBy ? plan.start : null;

  const keptBefore = events.slice(0, a + 1);
  const keptAfter = nextEvent ? events.slice(b) : [];
  const baseTime = Math.max(now.getTime(), a >= 0 ? eventEnd(keptBefore[a]) : new Date(plan.leaveBy).getTime());
  const cursor = new Date(baseTime);

  let bridge: Leg[] = [];
  if (nextPoint && distanceMeters(prevPoint, nextPoint) > 40) {
    const trip = tripBetween(prevPoint, nextPoint, cursor, mode);
    if (!trip) return null;
    bridge = trip.legs;
  }

  const legs: Leg[] = [];
  const stops: Stop[] = [];
  const all: Event[] = [...keptBefore, ...bridge.map((leg) => ({ leg })), ...keptAfter];
  for (const e of all) {
    if ("leg" in e) legs.push(e.leg);
    else stops.push(e.stop);
  }
  return { plan: { ...plan, legs, stops, skipped: plan.skipped }, fromIndex: keptBefore.length, cursor, events: all };
}


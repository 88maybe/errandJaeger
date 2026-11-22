// Splits a trip into walk and ride segments with real coordinates, for the route map and the step list.
// Entrance names come only from MBTA data (lib/transit/stations.generated.ts); nothing inside stations is invented.
import { distanceMeters } from "../planner/geo";
import type { Leg, RoutePlan, TransitLeg, WalkLeg } from "../planner/types";
import { entrancesOf, stationById, type Station } from "../transit/data";
import { stationsOnRide } from "../transit/look";

type LatLng = { lat: number; lng: number };

export type WalkSegment = {
  kind: "walk";
  leg: WalkLeg;
  from: LatLng;
  to: LatLng;
  entrance: string | null; // MBTA entrance name at the station end of this walk, when the MBTA lists one
  role: "to-station" | "between-stations" | "to-place" | "direct";
};
export type RideSegment = { kind: "ride"; leg: TransitLeg; stations: Station[] };
export type Segment = WalkSegment | RideSegment;

// "5 | Summer St, Atlantic Ave" -> "Summer St, Atlantic Ave (entrance 5)"
export function entranceText(name: string): string {
  const m = name.match(/^\s*([\w-]+)\s*\|\s*(.+)$/);
  return m ? `${m[2]} (entrance ${m[1]})` : name;
}

function nearestEntrance(stationId: string, to: LatLng): { name: string; lat: number; lng: number } | null {
  const list = entrancesOf(stationId);
  if (list.length === 0) return null;
  return list.reduce((best, e) => (distanceMeters(e, to) < distanceMeters(best, to) ? e : best));
}

export function segmentsOf(plan: RoutePlan, origin: LatLng, dest: LatLng): Segment[] {
  const out: Segment[] = [];
  let here: LatLng = origin;
  plan.legs.forEach((leg: Leg, i) => {
    if (leg.type === "transit") {
      const stations = stationsOnRide(leg.routeIds, leg.stationId, leg.toStationId);
      out.push({ kind: "ride", leg, stations });
      here = stationById(leg.toStationId);
      return;
    }
    const prev = plan.legs[i - 1];
    const next = plan.legs[i + 1];
    const afterRide = prev?.type === "transit";
    const beforeRide = next?.type === "transit";
    if (beforeRide && afterRide) {
      // Walking outside from one station to another.
      out.push({ kind: "walk", leg, from: here, to: stationById(next.stationId), entrance: null, role: "between-stations" });
    } else if (beforeRide) {
      const station = stationById(next.stationId);
      const door = nearestEntrance(station.id, here);
      out.push({ kind: "walk", leg, from: here, to: door ?? station, entrance: door ? entranceText(door.name) : null, role: "to-station" });
    } else if (afterRide) {
      const station = stationById(prev.toStationId);
      const door = nearestEntrance(station.id, dest);
      out.push({ kind: "walk", leg, from: door ?? station, to: dest, entrance: door ? entranceText(door.name) : null, role: "to-place" });
    } else {
      out.push({ kind: "walk", leg, from: here, to: dest, entrance: null, role: "direct" });
    }
    here = out[out.length - 1].kind === "walk" ? (out[out.length - 1] as WalkSegment).to : here;
  });
  return out;
}

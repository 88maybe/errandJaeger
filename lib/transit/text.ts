// Turns a ride into short plain sentences. All facts come from the map, the router and the MBTA schedule, never from AI.
import { CHANGE_WALK_MIN, type Ride } from "./route";

const joinOr = (items: string[]) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`);
export const towardText = (toward: string[]) => joinOr(toward);

// "Green Line" when several branches work, "Green Line (D)" when only one does.
export const lineLabel = (ride: Ride) => (ride.sameWay.length > 1 ? ride.line.family : ride.line.name);

export type RideParts = {
  changeFrom: string | null;
  lineLabel: string;
  boardAt: string;
  platform: string;
  toward: string[];
  stops: number;
  rideMin: number;
  getOffAt: string;
  waitMin: number;
  departText: string | null; // e.g. "3:20 PM" when we know the real scheduled departure
  arriveText?: string | null; // e.g. "3:31 PM" when we know the real scheduled arrival
};

export function rideLines(r: RideParts): string[] {
  const lines: string[] = [];
  if (r.changeFrom) {
    lines.push(`Change at ${r.changeFrom} to the ${r.lineLabel}: about ${CHANGE_WALK_MIN} min walk inside the station (estimate).`);
  }
  lines.push(`Board at ${r.boardAt}, platform: ${r.platform}.`);
  lines.push(`Take the ${r.lineLabel} toward ${joinOr(r.toward)}.`);
  lines.push(
    r.departText
      ? `Next train leaves at ${r.departText} (scheduled).`
      : `Wait about ${r.waitMin - (r.changeFrom ? CHANGE_WALK_MIN : 0)} min for the train (estimate).`,
  );
  lines.push(
    r.arriveText
      ? `Ride ${r.stops} ${r.stops === 1 ? "stop" : "stops"}: arrives at ${r.arriveText} (scheduled).`
      : `Ride ${r.stops} ${r.stops === 1 ? "stop" : "stops"}: about ${r.rideMin} min (estimate).`,
  );
  lines.push(`Get off at ${r.getOffAt}.`);
  return lines;
}

export const transferNote = (ride: Ride): string | null =>
  ride.changeFrom ? `Change at ${ride.changeFrom.name} to the ${lineLabel(ride)}.` : null;

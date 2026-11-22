// Turns a ride into short plain sentences. All facts come from the map and router, never from AI.
import { CHANGE_WALK_MIN, WAIT_MIN, type Ride } from "./route";

const joinOr = (items: string[]) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`);

// "Green Line" when several branches work, "Green Line (D)" when only one does.
export const lineLabel = (ride: Ride) => (ride.sameWay.length > 1 ? ride.line.family : ride.line.name);

export function rideLines(ride: Ride): string[] {
  const lines: string[] = [];
  if (ride.changeFrom) {
    lines.push(`Change at ${ride.changeFrom.name} to the ${lineLabel(ride)}: about ${CHANGE_WALK_MIN} min walk inside the station (estimate).`);
  }
  lines.push(`Board at ${ride.from.name}, platform: ${ride.platform}.`);
  lines.push(`Take the ${lineLabel(ride)} toward ${joinOr(ride.toward)}.`);
  lines.push(`Ride ${ride.stops} ${ride.stops === 1 ? "stop" : "stops"}: about ${ride.rideMin} min (estimate), after about ${WAIT_MIN} min waiting for the train (estimate).`);
  lines.push(`Get off at ${ride.to.name}.`);
  return lines;
}

export function transferNote(ride: Ride): string | null {
  return ride.changeFrom ? `Change at ${ride.changeFrom.name} to the ${lineLabel(ride)}.` : null;
}

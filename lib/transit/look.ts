// How lines look on screen: MBTA colours and short chip labels ("GL B", "RL", "OL", "BL").
import { LINES, stationById, type Family, type Station } from "./data";

export const LINE_COLOUR: Record<Family, string> = {
  "Green Line": "#00843D",
  "Orange Line": "#ED8B00",
  "Red Line": "#DA291C",
  "Blue Line": "#003DA5",
};
const SHORT: Record<Family, string> = { "Green Line": "GL", "Orange Line": "OL", "Red Line": "RL", "Blue Line": "BL" };

const linesFor = (routeIds: string[]) => LINES.filter((l) => routeIds.includes(l.routeId));
const branches = (routeIds: string[]) => routeIds.filter((r) => r.startsWith("Green-")).map((r) => r.slice(6));

export function familyOf(routeIds: string[]): Family {
  return linesFor(routeIds)[0]?.family ?? "Green Line";
}

// "GL B", "GL B/C/D", "RL"
export function chipLabel(routeIds: string[]): string {
  const fam = familyOf(routeIds);
  const b = branches(routeIds);
  return fam === "Green Line" && b.length ? `${SHORT[fam]} ${b.join("/")}` : SHORT[fam];
}

// "Green Line B", "Green Line (B, C or D)", "Red Line"
export function rideName(routeIds: string[]): string {
  const fam = familyOf(routeIds);
  const b = branches(routeIds);
  if (fam !== "Green Line" || b.length === 0) return fam;
  return b.length === 1 ? `${fam} ${b[0]}` : `${fam} (${b.slice(0, -1).join(", ")} or ${b[b.length - 1]})`;
}

// The stations you pass on a ride, boarding and get-off stations included (from our hand-built map).
export function stationsOnRide(routeIds: string[], fromId: string, toId: string): Station[] {
  const line = linesFor(routeIds).find((l) => l.stations.includes(fromId) && l.stations.includes(toId));
  if (!line) return [];
  const a = line.stations.indexOf(fromId);
  const b = line.stations.indexOf(toId);
  const ids = a <= b ? line.stations.slice(a, b + 1) : line.stations.slice(b, a + 1).reverse();
  return ids.map(stationById);
}

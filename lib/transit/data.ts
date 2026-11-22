// A small HAND-BUILT map of the launch-area subway: stations, lines, platform names.
// Station ids, coordinates and platform names come from the MBTA API (see scripts/mbta-spike.ts).
// Stop order and branch terminals are written by hand. Only the part of each line near the launch area is listed.

export type Station = { id: string; name: string; lat: number; lng: number };

export type Line = {
  id: string; // our own short id
  name: string; // what riders call it, e.g. "Green Line (B)"
  family: "Green Line" | "Orange Line";
  stations: string[]; // station ids in order along the line
  towardFirst: string; // terminal you head to when riding toward stations[0]
  towardLast: string; // terminal you head to when riding toward the last station
};

export const STATIONS: Station[] = [
  { id: "place-kencl", name: "Kenmore", lat: 42.3489, lng: -71.0952 },
  { id: "place-fenwy", name: "Fenway", lat: 42.3454, lng: -71.1042 },
  { id: "place-hymnl", name: "Hynes Convention Center", lat: 42.3479, lng: -71.0879 },
  { id: "place-coecl", name: "Copley", lat: 42.35, lng: -71.0774 },
  { id: "place-armnl", name: "Arlington", lat: 42.3519, lng: -71.0709 },
  { id: "place-boyls", name: "Boylston", lat: 42.353, lng: -71.0646 },
  { id: "place-pktrm", name: "Park Street", lat: 42.3564, lng: -71.0624 },
  { id: "place-gover", name: "Government Center", lat: 42.3597, lng: -71.0592 },
  { id: "place-haecl", name: "Haymarket", lat: 42.363, lng: -71.0583 },
  { id: "place-north", name: "North Station", lat: 42.3656, lng: -71.0613 },
  { id: "place-mfa", name: "Museum of Fine Arts", lat: 42.3377, lng: -71.0955 },
  { id: "place-nuniv", name: "Northeastern University", lat: 42.3404, lng: -71.0888 },
  { id: "place-symcl", name: "Symphony", lat: 42.3427, lng: -71.0851 },
  { id: "place-prmnl", name: "Prudential", lat: 42.3456, lng: -71.0817 },
  { id: "place-bbsta", name: "Back Bay", lat: 42.3473, lng: -71.0757 },
  { id: "place-tumnl", name: "Tufts Medical Center", lat: 42.3497, lng: -71.0639 },
  { id: "place-chncl", name: "Chinatown", lat: 42.3525, lng: -71.0628 },
  { id: "place-dwnxg", name: "Downtown Crossing", lat: 42.3555, lng: -71.0602 },
  { id: "place-state", name: "State", lat: 42.359, lng: -71.0576 },
];

// Green Line trunk shared by B, C, D and E (west to east).
const TRUNK = ["place-coecl", "place-armnl", "place-boyls", "place-pktrm", "place-gover"];

export const LINES: Line[] = [
  {
    id: "green-b",
    name: "Green Line (B)",
    family: "Green Line",
    stations: ["place-kencl", "place-hymnl", ...TRUNK],
    towardFirst: "Boston College",
    towardLast: "Government Center",
  },
  {
    id: "green-c",
    name: "Green Line (C)",
    family: "Green Line",
    stations: ["place-kencl", "place-hymnl", ...TRUNK, "place-haecl", "place-north"],
    towardFirst: "Cleveland Circle",
    towardLast: "North Station",
  },
  {
    id: "green-d",
    name: "Green Line (D)",
    family: "Green Line",
    stations: ["place-fenwy", "place-kencl", "place-hymnl", ...TRUNK, "place-haecl", "place-north"],
    towardFirst: "Riverside",
    towardLast: "Union Square",
  },
  {
    id: "green-e",
    name: "Green Line (E)",
    family: "Green Line",
    stations: ["place-mfa", "place-nuniv", "place-symcl", "place-prmnl", ...TRUNK, "place-haecl", "place-north"],
    towardFirst: "Heath Street",
    towardLast: "Medford/Tufts",
  },
  {
    id: "orange",
    name: "Orange Line",
    family: "Orange Line",
    stations: ["place-bbsta", "place-tumnl", "place-chncl", "place-dwnxg", "place-state", "place-haecl", "place-north"],
    towardFirst: "Forest Hills",
    towardLast: "Oak Grove",
  },
];

// Platform names as the MBTA lists them. "first" = riding toward stations[0], "last" = toward the last station.
// A line id key beats the "*" default for that station.
type PlatformNames = { first: Record<string, string>; last: Record<string, string> };

const GREEN_EAST_DEFAULT = "Park Street & North";
const GREEN_WEST_DEFAULT = "Copley & West";

export const PLATFORMS: Record<string, PlatformNames> = {
  green: {
    // riding west (toward the first station of the line)
    first: {
      "place-fenwy": "Riverside",
      "place-kencl:green-b": "Boston College",
      "place-kencl": "Cleveland Circle, Riverside",
      "place-hymnl": "Kenmore & West",
      "place-coecl": "Kenmore & West, Heath Street",
      "place-pktrm:green-b": "Boston College",
      "place-pktrm:green-c": "Cleveland Circle",
      "place-pktrm:green-d": "Riverside",
      "place-pktrm:green-e": "Heath Street",
      "place-symcl": "Heath Street",
      "place-prmnl": "Heath Street",
      "place-nuniv": "Heath Street",
      "place-mfa": "Heath Street",
    },
    // riding east (toward the last station of the line)
    last: {
      "place-pktrm": "Government Center & North",
      "place-gover": "North Station & North",
      "place-haecl": "North Station & North",
    },
  },
  orange: {
    first: { "*": "Forest Hills" },
    last: { "*": "Oak Grove" },
  },
};

export function platformName(line: Line, stationId: string, toward: "first" | "last"): string {
  const table = PLATFORMS[line.family === "Orange Line" ? "orange" : "green"][toward];
  return (
    table[`${stationId}:${line.id}`] ??
    table[stationId] ??
    table["*"] ??
    (toward === "last" ? GREEN_EAST_DEFAULT : GREEN_WEST_DEFAULT)
  );
}

export const stationById = (id: string): Station => {
  const s = STATIONS.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown station ${id}`);
  return s;
};

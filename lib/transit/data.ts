// A small HAND-BUILT map of the central subway: stations, lines, platform names.
// Station names, coordinates, entrances and terminals come from the MBTA API (npm run sync:terminals writes
// stations.generated.ts and terminals.generated.ts). The stop order of each line is written by hand and checked
// by that same script. Only the central part of each line is listed.

import { STATION_DATA } from "./stations.generated";
import { TERMINALS } from "./terminals.generated";

export type Station = { id: string; name: string; lat: number; lng: number };

export type Family = "Green Line" | "Orange Line" | "Red Line" | "Blue Line";

export type Line = {
  id: string; // our own short id
  routeId: string; // the MBTA route id, e.g. "Green-B"
  name: string; // what riders call it, e.g. "Green Line (B)"
  family: Family;
  stations: string[]; // station ids in order along the line (west/south first)
  towardFirst: string; // terminal you head to when riding toward stations[0] (from the MBTA routes data)
  towardLast: string; // terminal you head to when riding toward the last station (from the MBTA routes data)
};

// Stations a short walk apart (about 5 minutes or less), so you can change between lines outside the station.
// Walking time is worked out from distance and labelled as an estimate wherever it is shown.
export const WALK_LINKS: [string, string][] = [
  ["place-dwnxg", "place-pktrm"], // Downtown Crossing (Orange) to Park Street (Green)
  ["place-haecl", "place-gover"], // Haymarket (Orange) to Government Center (Green)
  ["place-state", "place-gover"], // State (Orange) to Government Center (Green)
  ["place-chncl", "place-boyls"], // Chinatown (Orange) to Boylston (Green)
  ["place-bomnl", "place-gover"], // Bowdoin (Blue) to Government Center (Green)
];

// Green Line trunk shared by B, C, D and E (west to east).
const TRUNK = ["place-coecl", "place-armnl", "place-boyls", "place-pktrm", "place-gover"];

export const LINES: Line[] = [
  {
    id: "green-b",
    routeId: "Green-B",
    name: "Green Line (B)",
    family: "Green Line",
    stations: ["place-harvd", "place-brico", "place-babck", "place-amory", "place-bucen", "place-buest", "place-bland", "place-kencl", "place-hymnl", ...TRUNK],
    towardFirst: TERMINALS["Green-B"].first,
    towardLast: TERMINALS["Green-B"].last,
  },
  {
    id: "green-c",
    routeId: "Green-C",
    name: "Green Line (C)",
    family: "Green Line",
    stations: ["place-kencl", "place-hymnl", ...TRUNK], // ends at Government Center (checked against the MBTA)
    towardFirst: TERMINALS["Green-C"].first,
    towardLast: TERMINALS["Green-C"].last,
  },
  {
    id: "green-d",
    routeId: "Green-D",
    name: "Green Line (D)",
    family: "Green Line",
    stations: ["place-fenwy", "place-kencl", "place-hymnl", ...TRUNK, "place-haecl", "place-north"],
    towardFirst: TERMINALS["Green-D"].first,
    towardLast: TERMINALS["Green-D"].last,
  },
  {
    id: "green-e",
    routeId: "Green-E",
    name: "Green Line (E)",
    family: "Green Line",
    stations: ["place-mfa", "place-nuniv", "place-symcl", "place-prmnl", ...TRUNK, "place-haecl", "place-north"],
    towardFirst: TERMINALS["Green-E"].first,
    towardLast: TERMINALS["Green-E"].last,
  },
  {
    id: "orange",
    routeId: "Orange",
    name: "Orange Line",
    family: "Orange Line",
    stations: ["place-bbsta", "place-tumnl", "place-chncl", "place-dwnxg", "place-state", "place-haecl", "place-north"],
    towardFirst: TERMINALS["Orange"].first,
    towardLast: TERMINALS["Orange"].last,
  },
  {
    id: "red",
    routeId: "Red",
    name: "Red Line",
    family: "Red Line",
    // South to north. At JFK/UMass the line splits (Ashmont, Braintree) and platforms are named per branch, so we stop at Andrew.
    stations: [
      "place-andrw", "place-brdwy", "place-sstat", "place-dwnxg", "place-pktrm",
      "place-chmnl", "place-knncl", "place-cntsq", "place-harsq", "place-portr", "place-davis", "place-alfcl",
    ],
    towardFirst: TERMINALS["Red"].first,
    towardLast: TERMINALS["Red"].last,
  },
  {
    id: "blue",
    routeId: "Blue",
    name: "Blue Line",
    family: "Blue Line",
    stations: ["place-bomnl", "place-gover", "place-state", "place-aqucl", "place-mvbcl", "place-aport", "place-wimnl"],
    towardFirst: TERMINALS["Blue"].first,
    towardLast: TERMINALS["Blue"].last,
  },
];

// Every station on our lines, with the MBTA's own name and position.
export const STATIONS: Station[] = [...new Set(LINES.flatMap((l) => l.stations))].flatMap((id) => {
  const s = STATION_DATA[id];
  return s ? [{ id, name: s.name, lat: s.lat, lng: s.lng }] : []; // missing = run npm run sync:terminals
});

// Station entrances as the MBTA names them (only where the MBTA lists them).
export const entrancesOf = (stationId: string) => STATION_DATA[stationId]?.entrances ?? [];

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
      "place-bland": "Boston College",
      "place-buest": "Boston College",
      "place-bucen": "Boston College",
      "place-amory": "Boston College",
      "place-babck": "Boston College",
      "place-brico": "Boston College",
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
  // Red and Blue platforms are named after the terminal they head to (checked by npm run sync:terminals).
  if (line.family === "Red Line" || line.family === "Blue Line") return toward === "first" ? line.towardFirst : line.towardLast;
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

// Reads the MBTA /routes and /stops data and rewrites lib/transit/terminals.generated.ts and
// lib/transit/stations.generated.ts (station names, positions and named entrances).
// Also checks that every station on our hand-built lines is really served by that route, and prints the
// platform names at Red and Blue Line stations (the app names those platforms after the terminal).
// It reports anything that DIFFERS from what the app had before.
//
// Run:  npm run sync:terminals      (optional: MBTA_API_KEY=... to go faster)
import { writeFileSync } from "node:fs";
import { LINES } from "../lib/transit/data";
import { TERMINALS } from "../lib/transit/terminals.generated";
import { STATION_DATA, type StationData } from "../lib/transit/stations.generated";
import { OUTSIDE_HEADERS } from "../lib/http";

const BASE = "https://api-v3.mbta.com";
const KEY = process.env.MBTA_API_KEY;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(path: string) {
  await sleep(KEY ? 200 : 3500); // no key = about 20 requests a minute
  const res = await fetch(BASE + path, { headers: KEY ? { ...OUTSIDE_HEADERS, "x-api-key": KEY } : OUTSIDE_HEADERS });
  if (!res.ok) throw new Error(`${res.status} for ${path}`);
  return (await res.json()) as {
    data: { id: string; attributes: Record<string, any>; relationships?: Record<string, any> }[];
    included?: { id: string; attributes: Record<string, any>; relationships?: Record<string, any> }[];
  };
}

async function main() {
  const ids = LINES.map((l) => l.routeId);
  const routes = await get(`/routes?filter[id]=${ids.join(",")}`);
  const next: Record<string, { first: string; last: string }> = {};
  const diffs: string[] = [];

  for (const r of routes.data) {
    const names: string[] = r.attributes.direction_names;
    const dests: string[] = r.attributes.direction_destinations;
    const pick = (a: string, b: string) => dests[names.findIndex((n) => n === a || n === b)];
    next[r.id] = { first: pick("West", "South"), last: pick("East", "North") };
    const old = TERMINALS[r.id];
    if (!old) diffs.push(`${r.id}: new route`);
    else {
      if (old.first !== next[r.id].first) diffs.push(`${r.id}: toward-first "${old.first}" is now "${next[r.id].first}"`);
      if (old.last !== next[r.id].last) diffs.push(`${r.id}: toward-last "${old.last}" is now "${next[r.id].last}"`);
    }
    console.log(`${r.id}: ${names.join("/")} -> ${dests.join(" / ")}`);
  }

  // Do the stations we listed really belong to each route?
  const stations: Record<string, StationData> = {};
  for (const line of LINES) {
    const stops = await get(`/stops?filter[route]=${line.routeId}&filter[location_type]=1`);
    const served = new Set(stops.data.map((s) => s.id));
    for (const s of stops.data) {
      if (!line.stations.includes(s.id)) continue;
      const a = s.attributes;
      stations[s.id] = { name: a.name, lat: Math.round(a.latitude * 1e4) / 1e4, lng: Math.round(a.longitude * 1e4) / 1e4, entrances: [] };
    }
    const missing = line.stations.filter((id) => !served.has(id));
    console.log(`${line.routeId}: ${line.stations.length} stations listed, ${missing.length} not served`);
    if (missing.length) diffs.push(`${line.routeId}: stations not served by this route: ${missing.join(", ")}`);
  }

  // Named entrances (location_type 2) and platform names (location_type 0) for our stations.
  const stationIds = Object.keys(stations);
  const withKids = await get(`/stops?filter[id]=${stationIds.join(",")}&include=child_stops`);
  const platformNames = new Map<string, Set<string>>();
  for (const kid of withKids.included ?? []) {
    const parent = kid.relationships?.parent_station?.data?.id as string | undefined;
    if (!parent || !stations[parent]) continue;
    const a = kid.attributes;
    if (a.location_type === 2 && a.name && typeof a.latitude === "number") {
      // "South Station - Summer St" -> "Summer St"
      const prefix = `${stations[parent].name} - `;
      const name = String(a.name).startsWith(prefix) ? String(a.name).slice(prefix.length) : String(a.name);
      stations[parent].entrances.push({ name, lat: Math.round(a.latitude * 1e5) / 1e5, lng: Math.round(a.longitude * 1e5) / 1e5 });
    }
    if (a.location_type === 0 && a.platform_name && (a.vehicle_type === 1)) {
      platformNames.set(parent, (platformNames.get(parent) ?? new Set()).add(a.platform_name));
    }
  }
  for (const line of LINES.filter((l) => l.family === "Red Line" || l.family === "Blue Line")) {
    const expected = new Set([line.towardFirst, line.towardLast]);
    for (const id of line.stations) {
      const names = [...(platformNames.get(id) ?? [])];
      const odd = names.filter((n) => !expected.has(n) && !LINES.some((o) => o.family !== line.family && (o.towardFirst === n || o.towardLast === n)));
      if (odd.length) diffs.push(`${line.routeId} ${stations[id]?.name}: platform names ${odd.join(", ")} (app uses the terminal name)`);
    }
  }
  const missing = [...new Set(LINES.flatMap((l) => l.stations))].filter((id) => !stations[id]);
  if (missing.length) diffs.push(`stations not found: ${missing.join(", ")}`);
  const newIds = stationIds.filter((id) => !STATION_DATA[id]);
  if (newIds.length && Object.keys(STATION_DATA).length) diffs.push(`new stations: ${newIds.join(", ")}`);
  writeFileSync(
    new URL("../lib/transit/stations.generated.ts", import.meta.url),
    `// GENERATED by scripts/mbta-terminals.ts (npm run sync:terminals). Do not edit by hand.
// Source: MBTA /stops (stations, positions, named entrances). Fetched ${new Date().toISOString().slice(0, 10)}.
export type StationData = { name: string; lat: number; lng: number; entrances: { name: string; lat: number; lng: number }[] };
export const STATION_DATA: Record<string, StationData> = ${JSON.stringify(stations, null, 1)};
`,
  );
  console.log(`Stations: ${stationIds.length}, with named entrances: ${stationIds.filter((id) => stations[id].entrances.length).length}`);

  const body = `// GENERATED by scripts/mbta-terminals.ts (npm run sync:terminals). Do not edit by hand.
// Source: MBTA /routes direction_destinations. West/South is "first", East/North is "last".
export const TERMINALS_FETCHED = "${new Date().toISOString().slice(0, 10)}";
export const TERMINALS: Record<string, { first: string; last: string }> = ${JSON.stringify(next, null, 2)};
`;
  writeFileSync(new URL("../lib/transit/terminals.generated.ts", import.meta.url), body);
  console.log(diffs.length ? `\nDIFFERENCES:\n- ${diffs.join("\n- ")}` : "\nNo differences from what the app had.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

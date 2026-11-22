// READ-ONLY spike: what does the MBTA V3 API offer for our launch area?
// It only calls GET endpoints and prints what it finds. It does not touch the app.
//
// Run:  npm run spike:mbta
// Optional: MBTA_API_KEY=your_key npm run spike:mbta   (a key raises the rate limit; without one we go slowly)
import data from "../data/places.json";

const BASE = "https://api-v3.mbta.com";
const KEY = process.env.MBTA_API_KEY;
const PAUSE_MS = KEY ? 250 : 3300; // no key = about 20 requests a minute, so wait between calls

type Resource = { id: string; type: string; attributes: Record<string, any>; relationships?: Record<string, any> };
type Doc = { data: Resource[] | Resource; included?: Resource[] };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let calls = 0;

async function get(path: string, params: Record<string, string> = {}): Promise<Doc> {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  for (let attempt = 0; attempt < 3; attempt++) {
    await sleep(PAUSE_MS);
    calls++;
    const res = await fetch(url, { headers: KEY ? { "x-api-key": KEY } : {} });
    if (res.status === 429) {
      console.log("  (rate limited, waiting 20s)");
      await sleep(20000);
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url.pathname}${url.search}`);
    return (await res.json()) as Doc;
  }
  throw new Error("still rate limited");
}

const list = (d: Doc) => (Array.isArray(d.data) ? d.data : [d.data]);
const boston = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }) : "n/a";

async function main() {
  console.log(`MBTA V3 spike (${KEY ? "with API key" : "no API key: going slowly"})\n`);

  // 1. Do our places' nearestStop names exist as real subway/light-rail stations?
  const wanted = [...new Set((data.places as { nearestStop: string }[]).map((p) => p.nearestStop))].sort();
  // (Asking by route_type returns nothing for stations, so we ask by route instead.)
  const routes = list(await get("/routes", { "filter[type]": "0,1" }));
  const stations = list(await get("/stops", { "filter[route]": routes.map((r) => r.id).join(","), "filter[location_type]": "1" }));
  const byName = new Map(stations.map((s) => [s.attributes.name as string, s]));
  console.log("=== 1. Our nearestStop names vs real MBTA stations ===");
  const found: Resource[] = [];
  for (const name of wanted) {
    const s = byName.get(name);
    console.log(`  ${s ? "OK     " : "MISSING"} ${name}${s ? `  (id ${s.id})` : ""}`);
    if (s) found.push(s);
  }

  // 2. Platforms (child stops) for those stations: platform names and codes
  const withPlatforms = await get("/stops", { "filter[id]": found.map((s) => s.id).join(","), include: "child_stops" });
  console.log("\n=== 2. Platform data (what could tell you which platform / direction to look for) ===");
  const platformsByStation = new Map<string, Resource[]>();
  for (const child of withPlatforms.included ?? []) {
    if (child.type !== "stop" || child.attributes.location_type !== 0) continue; // 0 = a real boarding platform (skip entrances, stairs)
    const parent = child.relationships?.parent_station?.data?.id as string | undefined;
    if (!parent) continue;
    platformsByStation.set(parent, [...(platformsByStation.get(parent) ?? []), child]);
  }
  for (const station of found) {
    const kids = platformsByStation.get(station.id) ?? [];
    console.log(`  ${station.attributes.name}: ${kids.length} platform(s)`);
    for (const k of kids.slice(0, 6)) {
      const a = k.attributes;
      console.log(`     - id ${k.id} | platform_name: ${JSON.stringify(a.platform_name)} | platform_code: ${JSON.stringify(a.platform_code)} | description: ${JSON.stringify(a.description)}`);
    }
  }

  // 3. Routes: direction names and destinations (the "toward Alewife" text)
  console.log("\n=== 3. Direction names and destinations per line ===");
  for (const r of routes) {
    const a = r.attributes;
    console.log(`  ${String(a.long_name).padEnd(28)} id ${r.id.padEnd(9)} dir0: ${a.direction_names?.[0]} -> ${a.direction_destinations?.[0]} | dir1: ${a.direction_names?.[1]} -> ${a.direction_destinations?.[1]}`);
  }

  // 4. Last departure of the day for a few lines at launch-area stations
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }); // YYYY-MM-DD
  const idOf = (name: string) => byName.get(name)?.id;
  const checks: [string, string, string][] = [
    ["Green-B", "Kenmore", "Green Line B at Kenmore"],
    ["Green-D", "Fenway", "Green Line D at Fenway"],
    ["Orange", "Back Bay", "Orange Line at Back Bay"],
  ];
  console.log(`\n=== 4. Last departure of the service day (${today}) ===`);
  for (const [route, stationName, label] of checks) {
    const stopId = idOf(stationName);
    const routeInfo = routes.find((r) => r.id === route);
    if (!stopId || !routeInfo) {
      console.log(`  ${label}: not found`);
      continue;
    }
    for (const dir of [0, 1]) {
      const schedules = list(
        await get("/schedules", {
          "filter[route]": route,
          "filter[stop]": stopId,
          "filter[direction_id]": String(dir),
          "filter[date]": today,
          sort: "-departure_time",
          "page[limit]": "3",
        }),
      );
      const last = schedules.find((s) => s.attributes.departure_time);
      console.log(`  ${label}, toward ${routeInfo.attributes.direction_destinations?.[dir]}: last departure ${boston(last?.attributes.departure_time)}${last ? ` (raw ${last.attributes.departure_time})` : ""}`);
    }
  }

  // 5. Live predictions at Kenmore: what a "next train" line could use
  const kenmore = idOf("Kenmore");
  if (kenmore) {
    const preds = await get("/predictions", { "filter[stop]": kenmore, include: "stop,route", sort: "departure_time", "page[limit]": "6" });
    const included = new Map((preds.included ?? []).map((i) => [`${i.type}:${i.id}`, i]));
    console.log("\n=== 5. Live predictions at Kenmore ===");
    const rows = list(preds);
    if (rows.length === 0) console.log("  (none right now: probably outside service hours)");
    for (const p of rows) {
      const stop = included.get(`stop:${p.relationships?.stop?.data?.id}`);
      const route = p.relationships?.route?.data?.id;
      console.log(`  ${String(route).padEnd(8)} dir ${p.attributes.direction_id} | departs ${boston(p.attributes.departure_time ?? p.attributes.arrival_time)} | status ${JSON.stringify(p.attributes.status)} | platform ${JSON.stringify(stop?.attributes.platform_name)}`);
    }
  }

  // 6. Bus stops near Kenmore Square (bus has no platforms, just stops and directions)
  const bus = await get("/stops", {
    "filter[latitude]": "42.3489",
    "filter[longitude]": "-71.0953",
    "filter[radius]": "0.004",
    "filter[route_type]": "3",
  });
  const busStops = list(bus);
  console.log(`\n=== 6. Bus stops within ~400 m of Kenmore Square: ${busStops.length} ===`);
  for (const s of busStops.slice(0, 5)) {
    console.log(`  id ${s.id} | ${s.attributes.name} | on_street ${JSON.stringify(s.attributes.on_street)} | at_street ${JSON.stringify(s.attributes.at_street)} | platform_code ${JSON.stringify(s.attributes.platform_code)}`);
  }

  console.log(`\nDone: ${calls} requests, read-only.`);
}

main().catch((e) => {
  console.error("Spike failed:", e.message);
  process.exit(1);
});

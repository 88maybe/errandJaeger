import { guard } from "@/lib/ai/guard";
import { ALERT_TTL_MS, SCHEDULE_TTL_MS, mbtaGet } from "@/lib/mbta/server";
import { LINES, STATIONS } from "@/lib/transit/data";
import type { CheckLeg, CheckResponse } from "@/lib/transit/client";

// Looks up REAL MBTA data for the train rides in a plan: the day's scheduled departures and active alerts.
// Server side only, so the MBTA key stays private. We only accept station and route ids from our own map.
const ROUTE_IDS = new Set(LINES.map((l) => l.routeId));
const STATION_IDS = new Set(STATIONS.map((s) => s.id));
const lineNames = new Map(LINES.map((l) => [l.routeId, l.name]));

type Schedule = { attributes: { departure_time: string | null } };
type Alert = {
  id: string;
  attributes: {
    short_header: string | null;
    header: string;
    effect: string;
    severity: number;
    informed_entity: { route?: string; stop?: string }[];
  };
};

export async function POST(request: Request) {
  const body = await guard(request);
  if (body instanceof Response) return body;

  const date = typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : null;
  const legs: CheckLeg[] = (Array.isArray(body.legs) ? body.legs : [])
    .slice(0, 8)
    .flatMap((l: any) =>
      l &&
      STATION_IDS.has(l.stationId) &&
      (l.directionId === 0 || l.directionId === 1) &&
      Array.isArray(l.routeIds) &&
      l.routeIds.length > 0 &&
      l.routeIds.every((r: unknown) => typeof r === "string" && ROUTE_IDS.has(r))
        ? [{ stationId: l.stationId, directionId: l.directionId, routeIds: l.routeIds as string[] }]
        : [],
    );
  if (!date || legs.length === 0) return Response.json({ ok: false, reason: "bad-request" }, { status: 400 });

  // One schedule lookup per distinct (station, routes, direction).
  const keys = [...new Set(legs.map(legKey))];
  const departures: CheckResponse["departures"] = {};
  await Promise.all(
    keys.map(async (key) => {
      const leg = legs.find((l) => legKey(l) === key)!;
      const data = await mbtaGet<{ data: Schedule[] }>(
        "/schedules",
        {
          "filter[stop]": leg.stationId,
          "filter[route]": leg.routeIds.join(","),
          "filter[direction_id]": String(leg.directionId),
          "filter[date]": date,
          sort: "departure_time",
          "fields[schedule]": "departure_time",
          "page[limit]": "1000",
        },
        SCHEDULE_TTL_MS,
      );
      if (!data || !Array.isArray(data.data)) return; // missing key = this lookup failed
      departures[key] = data.data
        .map((s) => s.attributes.departure_time)
        .filter((t): t is string => !!t)
        .sort();
    }),
  );

  // Active alerts on the lines in this plan.
  const routeIds = [...new Set(legs.flatMap((l) => l.routeIds))];
  const alertData = await mbtaGet<{ data: Alert[] }>(
    "/alerts",
    {
      "filter[route]": routeIds.join(","),
      "filter[activity]": "BOARD,EXIT,RIDE",
      "filter[datetime]": "NOW",
      "fields[alert]": "short_header,header,effect,severity,informed_entity",
    },
    ALERT_TTL_MS,
  );

  // Keep alerts for the whole line, or for a stop at one of OUR stations. (Alerts for far-away stops on the same line are noise.)
  const platformIds = await stationPlatformIds();
  const relevant = (a: Alert) =>
    a.attributes.informed_entity.some((e) => !e.stop || platformIds.has(e.stop) || STATION_IDS.has(e.stop));

  const alerts = alertData
    ? alertData.data
        .filter(relevant)
        .sort((a, b) => b.attributes.severity - a.attributes.severity)
        .slice(0, 6)
        .map((a) => ({
          id: a.id,
          text: (a.attributes.short_header || a.attributes.header).slice(0, 220),
          effect: a.attributes.effect,
          lines: [...new Set(a.attributes.informed_entity.map((e) => e.route).filter((r): r is string => !!r && routeIds.includes(r)))].map(
            (r) => lineNames.get(r) ?? r,
          ),
        }))
    : null;

  const response: CheckResponse = { ok: true, departures, alerts };
  return Response.json(response);
}

function legKey(l: CheckLeg) {
  return `${l.stationId}|${l.routeIds.join(",")}|${l.directionId}`;
}

// Platform stop ids of the stations in our map (so we can tell which stop-level alerts matter). Cached for a day.
async function stationPlatformIds(): Promise<Set<string>> {
  const data = await mbtaGet<{ included?: { id: string }[] }>(
    "/stops",
    { "filter[id]": STATIONS.map((s) => s.id).join(","), include: "child_stops", "fields[stop]": "name" },
    24 * 60 * 60_000,
  );
  return new Set((data?.included ?? []).map((c) => c.id));
}

import { guard } from "@/lib/ai/guard";
import { mbtaGet } from "@/lib/mbta/server";
import { LINES, STATIONS } from "@/lib/transit/data";
import { liveKey, type LivePrediction, type LiveResponse } from "@/lib/transit/live";

// Live MBTA predictions for the boarding stations of a plan. Server side only (the key stays private).
// Cached for 15 seconds, so many people polling every 30 seconds don't hammer the MBTA.
const LIVE_TTL_MS = 15_000;
const ROUTE_IDS = new Set(LINES.map((l) => l.routeId));
const STATION_IDS = new Set(STATIONS.map((s) => s.id));

type Prediction = {
  attributes: {
    arrival_time: string | null;
    departure_time: string | null;
    status: string | null;
    schedule_relationship: string | null;
  };
  relationships: { trip: { data: { id: string } | null } };
};
type Ask = { stationId: string; directionId: 0 | 1; routeIds: string[] };

export async function POST(request: Request) {
  const body = await guard(request);
  if (body instanceof Response) return body;

  const legs: Ask[] = (Array.isArray(body.legs) ? body.legs : []).slice(0, 8).flatMap((l: any) =>
    l &&
    STATION_IDS.has(l.stationId) &&
    (l.directionId === 0 || l.directionId === 1) &&
    Array.isArray(l.routeIds) &&
    l.routeIds.length > 0 &&
    l.routeIds.every((r: unknown) => typeof r === "string" && ROUTE_IDS.has(r))
      ? [{ stationId: l.stationId as string, directionId: l.directionId as 0 | 1, routeIds: l.routeIds as string[] }]
      : [],
  );
  if (legs.length === 0) return Response.json({ ok: false, reason: "bad-request" }, { status: 400 });

  const keys = [...new Set(legs.map(liveKey))];
  const predictions: LiveResponse["predictions"] = {};
  await Promise.all(
    keys.map(async (key) => {
      const leg = legs.find((l) => liveKey(l) === key)!;
      const data = await mbtaGet<{ data: Prediction[] }>(
        "/predictions",
        {
          "filter[stop]": leg.stationId,
          "filter[route]": leg.routeIds.join(","),
          "filter[direction_id]": String(leg.directionId),
          sort: "departure_time",
          "page[limit]": "12",
        },
        LIVE_TTL_MS,
        5000,
      );
      if (!data || !Array.isArray(data.data)) return; // missing key = no live data for this stop
      predictions[key] = data.data.map(
        (p): LivePrediction => ({
          trip: p.relationships.trip.data?.id ?? null,
          dep: p.attributes.departure_time ?? p.attributes.arrival_time,
          status: p.attributes.status,
          relationship: p.attributes.schedule_relationship,
        }),
      );
    }),
  );
  const response: LiveResponse = { ok: true, predictions };
  return Response.json(response);
}

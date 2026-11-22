import { rateLimited } from "@/lib/ai/guard";
import { inArea } from "@/lib/nearby/categories";
import { osrmRoute } from "@/lib/osrm/server";
import type { OsrmResponse } from "@/lib/osrm/types";

// Walking or driving directions between two points in Greater Boston (OSRM). SERVER ONLY.
// The browser rounds your live location before sending it; places are sent as they are.
const parse = (v: string | null): [number, number] | null => {
  const [lat, lng] = (v ?? "").split(",").map(Number);
  return Number.isFinite(lat) && Number.isFinite(lng) && inArea({ lat, lng }) ? [Math.round(lat * 1e5) / 1e5, Math.round(lng * 1e5) / 1e5] : null;
};

export async function GET(request: Request) {
  if (rateLimited(request)) return Response.json({ ok: false, reason: "rate-limited" } satisfies OsrmResponse, { status: 429 });
  const url = new URL(request.url);
  const profile = url.searchParams.get("profile");
  const from = parse(url.searchParams.get("from"));
  const to = parse(url.searchParams.get("to"));
  if ((profile !== "foot" && profile !== "car") || !from || !to) {
    return Response.json({ ok: false, reason: "bad-request" } satisfies OsrmResponse, { status: 400 });
  }
  const route = await osrmRoute(profile, from, to);
  return Response.json(route ?? ({ ok: false, reason: "unavailable" } satisfies OsrmResponse));
}

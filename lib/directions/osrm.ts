// Browser side: walking and driving routes from OUR server (which asks OSRM). Null on any problem.
import { roundCoord } from "../nearby/categories";
import type { OsrmResponse, OsrmRoute } from "../osrm/types";

type LatLng = { lat: number; lng: number };

// `private` = this point is your live location: it is rounded to about 100 m before it leaves the phone.
export async function fetchOsrm(profile: "foot" | "car", from: LatLng & { private?: boolean }, to: LatLng): Promise<OsrmRoute | null> {
  const f = from.private ? `${roundCoord(from.lat)},${roundCoord(from.lng)}` : `${from.lat},${from.lng}`;
  try {
    const res = await fetch(`/api/directions/osrm?profile=${profile}&from=${f}&to=${to.lat},${to.lng}`, { signal: AbortSignal.timeout(12_000) });
    const data = (await res.json()) as OsrmResponse;
    return data.ok ? data : null;
  } catch {
    return null;
  }
}

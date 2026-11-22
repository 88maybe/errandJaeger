// Distance and walking-time math. Plain code, no AI.

type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_M = 6371000;
const WALK_M_PER_MIN = 80; // a normal walking pace, about 4.8 km/h
const STREET_FACTOR = 1.3; // streets are not straight lines, so add 30%

const toRad = (deg: number) => (deg * Math.PI) / 180;

// Straight-line distance in metres between two points (haversine formula).
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

// Walking minutes (an ESTIMATE): bend the straight line by 30%, divide by pace, round up.
// Returns 0 when the two points are (almost) the same spot.
export function walkMinutes(a: LatLng, b: LatLng): number {
  const metres = distanceMeters(a, b) * STREET_FACTOR;
  return metres < 40 ? 0 : Math.ceil(metres / WALK_M_PER_MIN);
}

// Plain-words direction of travel, e.g. "north-west". Based on the straight line.
export function compassDirection(from: LatLng, to: LatLng): string {
  const dLng = toRad(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(to.lat));
  const x =
    Math.cos(toRad(from.lat)) * Math.sin(toRad(to.lat)) -
    Math.sin(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.cos(dLng);
  const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360; // 0 = north
  const names = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
  return names[Math.round(bearing / 45) % 8];
}

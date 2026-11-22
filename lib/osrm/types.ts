// A route from OSRM (OpenStreetMap routing). Facts only; every time is an ESTIMATE.
export type OsrmStep = { text: string; distanceM: number };
export type OsrmRoute = {
  ok: true;
  profile: "foot" | "car";
  distanceM: number;
  durationMin: number; // foot: from distance at our walking pace; car: OSRM's driving time (no traffic)
  geometry: [number, number][]; // [lng, lat] points along the way
  steps: OsrmStep[]; // turn-by-turn, plain words
};
export type OsrmResponse = OsrmRoute | { ok: false; reason: string };

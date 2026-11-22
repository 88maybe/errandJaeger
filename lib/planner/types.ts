// The shapes of the data the planner uses. Every planner file agrees on these.

// "errand" = pharmacy, laundry, bank/ATM and similar (from the map search).
export type Category = "grocery" | "snack" | "activity" | "errand";

// What the user can ask for. "favorite" matches any place tagged "favorite".
export type Need = Category | "favorite";

export type Busy = "quiet" | "medium" | "busy";

export type Place = {
  id: string;
  name: string;
  category: Category;
  tags: string[]; // e.g. "favorite", "downtown"
  area: string;
  lat: number;
  lng: number;
  nearestStop: string; // MBTA station name (for map-search places it is worked out from the coordinates)
  hours: Record<string, string>; // see data/places.json _note
  priceLevel?: 0 | 1 | 2 | 3;
  busyTimes?: { morning: Busy; midday: Busy; afternoon: Busy; evening: Busy }; // ESTIMATES
  hoursVerified: boolean;
  hoursUnknown?: boolean; // no opening hours at all (common on OpenStreetMap): we plan it but say "check before you go"
  kind?: string; // finer type from the map search, e.g. "pharmacy" (see lib/nearby/categories.ts)
  dwellMin?: number; // ESTIMATE of time spent there, when it differs from the category default
};

export type Point = { name: string; lat: number; lng: number };

export type PlanInput = {
  needs: Need[];
  startTime: Date; // a real moment in time; "open now" is judged in America/New_York
  loop: boolean; // walk back to the start at the end?
  mode?: "normal" | "calm"; // calm = shorter walks only (for now)
  start?: Point; // defaults to Kenmore Square
};

type LegBase = {
  from: string;
  to: string;
  startTime: string; // ISO time
  durationMin: number; // ESTIMATE
  instruction: string; // the full plain-words text for this leg
};

export type WalkLeg = LegBase & { type: "walk" };

// One ride on one line. Every fact here comes from the hand-built map in lib/transit (never from AI).
export type TransitLeg = LegBase & {
  type: "transit";
  lineLabel: string; // e.g. "Green Line" or "Orange Line"
  boardAt: string; // station you board at
  platform: string; // MBTA platform name
  toward: string[]; // terminal(s) to look for
  stops: number;
  getOffAt: string; // station
  waitMin: number; // ESTIMATE
  rideMin: number; // ESTIMATE
  changeFrom: string | null; // station name, set when this ride starts with a change of lines
  transferNote: string | null; // e.g. "Change at Haymarket to the Orange Line."
  lines: string[]; // the same facts as short sentences (for the screens)
  // What we need to look up the real schedule (see lib/planner/schedule.ts)
  stationId: string; // boarding station id
  toStationId: string; // get-off station id
  routeIds: string[]; // MBTA route ids that all work for this ride
  directionId: 0 | 1;
  // Filled in after the schedule check. Without these, times are plain estimates.
  tripId?: string; // the MBTA trip we planned you onto (used to match live predictions)
  departAt?: string; // ISO: the real next SCHEDULED departure
  arriveAt?: string; // ISO: the real SCHEDULED arrival at the get-off stop
  departBasis?: Basis; // "scheduled" once checked, else "estimate"
  arriveBasis?: Basis;
  lastDeparture?: string | null; // ISO: last scheduled departure of the service day from this stop
  lastWarning?: string | null; // loud text when you'd board within 45 min of it (or after it)
};

export type Leg = WalkLeg | TransitLeg;

// Where a time comes from. "live" = MBTA predictions, "scheduled" = the timetable, "estimate" = our own guess.
export type Basis = "live" | "scheduled" | "estimate";

export type Stop = {
  need: Need;
  place: Place;
  arriveAt: string; // ISO time
  leaveAt: string; // ISO time
  dwellMin: number; // ESTIMATE of time spent there
};

export type RoutePlan = {
  start: Point;
  leaveBy: string; // ISO time: when to head out
  backBy: string | null; // ISO time back at start (only if loop)
  endTime: string; // ISO time the last leg ends
  totalMin: number;
  stops: Stop[];
  legs: Leg[];
  skipped: { need: Need; reason: string; name?: string }[]; // name: set for a hitlist place
  warnings: string[];
  // Train check (MBTA schedule + alerts). Missing or "none" = the plan has no train rides.
  trainCheck?: "ok" | "partial" | "failed" | "none";
  trainWarnings?: string[]; // loud last-train warnings, shown at the top of the plan
  alerts?: PlanAlert[]; // active MBTA alerts on the lines used
};

export type PlanAlert = { id: string; text: string; effect: string; lines: string[] };

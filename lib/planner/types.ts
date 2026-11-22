// The shapes of the data the planner uses. Every planner file agrees on these.

export type Category = "grocery" | "snack" | "activity";

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
  nearestStop: string; // MBTA stop name (used from M3a)
  hours: Record<string, string>; // see data/places.json _note
  priceLevel: 0 | 1 | 2 | 3;
  busyTimes: { morning: Busy; midday: Busy; afternoon: Busy; evening: Busy }; // ESTIMATES
  hoursVerified: boolean;
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
  transferNote: string | null; // set when this ride starts with a change of lines
  lines: string[]; // the same facts as short sentences (for the screens)
};

export type Leg = WalkLeg | TransitLeg;

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
  skipped: { need: Need; reason: string }[];
  warnings: string[];
};

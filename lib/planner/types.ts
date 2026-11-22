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

export type Leg = {
  type: "walk"; // "transit" legs arrive in M3a
  from: string;
  to: string;
  startTime: string; // ISO time
  durationMin: number; // ESTIMATE
  instruction: string;
};

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

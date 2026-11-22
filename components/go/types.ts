import type { Summary } from "@/lib/directions/options";
import type { PlanAlert, RoutePlan } from "@/lib/planner/types";

// One departure chip: a time and where it comes from.
export type Dep = { time: string; basis: "scheduled" | "live"; note: string | null };

// One way to get there, ready to show.
export type ViewOption = {
  key: string;
  mode: "transit" | "walk" | "car";
  tags: string[];
  plan: RoutePlan; // walk: one walk leg; car: one leg described in `carMin`
  summary: Summary;
  deps: Dep[]; // next trains for the first ride
  alerts: PlanAlert[];
  checked: "scheduled" | "failed" | "pending" | "none"; // MBTA schedule lookup
  carMin?: number;
  distanceM?: number;
};

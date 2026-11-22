import { kindById } from "./nearby/categories";
import type { Stop } from "./planner/types";

export type GroupId = "errands" | "treats" | "wellbeing";

// Which colour group a plan stop belongs to: its map category, or what it was planned as.
export function stopGroup(s: Stop): GroupId {
  const fromKind = s.place.kind ? kindById(s.place.kind)?.group : undefined;
  return fromKind ?? (s.need === "grocery" || s.need === "errand" ? "errands" : s.need === "snack" ? "treats" : "wellbeing");
}

export const GROUP_LEGEND: { cls: string; label: string }[] = [
  { cls: "errands", label: "Errands" },
  { cls: "treats", label: "Treats" },
  { cls: "wellbeing", label: "Wellbeing" },
  { cls: "warn", label: "Warnings" },
];

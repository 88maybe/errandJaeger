"use client";

import type { TransitLeg } from "@/lib/planner/types";
import { formatNY } from "@/lib/planner/time";
import { chipLabel, familyOf, LINE_COLOUR } from "@/lib/transit/look";
import type { Dep, ViewOption } from "./types";

export function LineChip({ routeIds }: { routeIds: string[] }) {
  const colour = LINE_COLOUR[familyOf(routeIds)];
  return (
    <span className="line-chip" style={{ background: colour }}>
      {chipLabel(routeIds)}
    </span>
  );
}

// "Walk 5 › RL › GL B › Walk 3"
export function RouteStrip({ option }: { option: ViewOption }) {
  return (
    <span className="route-strip" aria-label="Route">
      {option.plan.legs.map((leg, i) => (
        <span key={i} className="strip-part">
          {i > 0 && <span className="strip-sep" aria-hidden="true">›</span>}
          {leg.type === "transit" ? <LineChip routeIds={(leg as TransitLeg).routeIds} /> : <span className="walk-chip">Walk {leg.durationMin}</span>}
        </span>
      ))}
    </span>
  );
}

export function DepChips({ deps }: { deps: Dep[] }) {
  if (deps.length === 0) return null;
  return (
    <span className="dep-chips">
      {deps.map((d, i) => (
        <span key={i} className={`dep-chip dep-${d.basis}`}>
          {formatNY(d.time)}
          <small>{d.basis === "live" ? "Live" : "Scheduled"}</small>
          {d.note && <small className="dep-note">{d.note}</small>}
        </span>
      ))}
    </span>
  );
}

// "Leave in 4 min" / "Leave now"
export function leaveInText(leaveAt: Date, now: Date): string {
  const min = Math.ceil((leaveAt.getTime() - now.getTime()) / 60000);
  return min <= 0 ? "Leave now" : `Leave in ${min} min`;
}

"use client";

import { useState } from "react";
import type { TransitLeg } from "@/lib/planner/types";
import { formatNY } from "@/lib/planner/time";
import LineChip from "@/components/LineChip";
import type { Dep, ViewOption } from "./types";

// "Walk 5 › RL › GL B › Walk 3"
export function RouteStrip({ option }: { option: ViewOption }) {
  return (
    <span className="route-strip" aria-label="Route">
      {option.plan.legs.map((leg, i) => (
        <span key={i} className="strip-part">
          {i > 0 && <span className="strip-sep" aria-hidden="true">›</span>}
          {leg.type === "transit" ? <LineChip routeIds={(leg as TransitLeg).routeIds} /> : <span className="walk-chip">Walk {leg.durationMin} min</span>}
        </span>
      ))}
    </span>
  );
}

// The next departures: 3 at first, "More times" shows the rest.
export function DepChips({ deps, first = 3 }: { deps: Dep[]; first?: number }) {
  const [all, setAll] = useState(false);
  if (deps.length === 0) return null;
  const shown = all ? deps : deps.slice(0, first);
  const extra = deps.length - first;
  return (
    <span className="dep-chips">
      {shown.map((d, i) => (
        <span key={i} className={`dep-chip dep-${d.basis}`}>
          {formatNY(d.time)}
          <small>{d.basis === "live" ? "Live" : "Scheduled"}</small>
          {d.note && <small className="dep-note">{d.note}</small>}
        </span>
      ))}
      {extra > 0 && (
        <button type="button" className="link-btn dep-more" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? "Fewer times" : `More times (${extra})`}
        </button>
      )}
    </span>
  );
}

// "Leave in 4 min" / "Leave now"
export function leaveInText(leaveAt: Date, now: Date): string {
  const min = Math.ceil((leaveAt.getTime() - now.getTime()) / 60000);
  return min <= 0 ? "Leave now" : `Leave in ${min} min`;
}

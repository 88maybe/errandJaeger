"use client";

import Link from "next/link";
import type { OsrmRoute } from "@/lib/osrm/types";
import type { Point } from "@/lib/planner/types";

export type FlowLeg = { from: Point; to: Point; minutes: number; route: OsrmRoute | null | undefined };

type Props = {
  legs: FlowLeg[]; // origin -> this stop -> each later stop, in order
  firstStop: number; // the plan's stop number of legs[0].to (0-based)
  onBack: () => void;
};

const dist = (m: number) => (m < 950 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);

// Walking: every remaining stop in one continuous list, under one map.
export default function WalkFlow({ legs, firstStop, onBack }: Props) {
  const total = legs.reduce((n, l) => n + l.minutes, 0);
  const meters = legs.reduce((n, l) => n + (l.route?.distanceM ?? 0), 0);
  const allKnown = legs.every((l) => l.route);
  return (
    <div className="route-view">
      <button type="button" className="link-back" onClick={onBack}>
        ‹ All options
      </button>
      <section className="summary-card" aria-label="Summary">
        <div className="summary-times">
          <div>
            <small>Stops</small>
            <strong>{legs.length}</strong>
          </div>
          <div>
            <small>Walking</small>
            <strong>{total} min</strong>
          </div>
          <div>
            <small>Distance</small>
            <strong>{allKnown && meters > 0 ? dist(meters) : "–"}</strong>
          </div>
        </div>
        <p className="bar-legend">Walking time only (estimate). Add the time you spend at each stop.</p>
      </section>

      <ol className="walk-flow">
        <li className="wf-point wf-start">
          <span className="wf-dot" aria-hidden="true" />
          <div>
            <small>From</small>
            <strong>{legs[0]?.from.name}</strong>
          </div>
        </li>
        {legs.map((l, i) => (
          <li key={i} className="wf-group">
            <div className="wf-walk">
              <span className="wf-line" aria-hidden="true" />
              <div>
                <strong>Walk {l.minutes} min</strong>
                <span className="soft">
                  {l.route ? `${dist(l.route.distanceM)} (estimate)` : l.route === undefined ? "Loading the walking directions…" : "Estimate from distance"}
                </span>
                {l.route && l.route.steps.length > 0 && (
                  <details className="rstep-more">
                    <summary>Turn-by-turn</summary>
                    <ol>
                      {l.route.steps.map((st, k) => (
                        <li key={k}>
                          {st.text}
                          <small> · {dist(st.distanceM)}</small>
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
              </div>
            </div>
            <div className="wf-point">
              <span className="wf-dot wf-stop" aria-hidden="true">
                {firstStop + i + 1}
              </span>
              <div>
                <small>Stop {firstStop + i + 1}</small>
                <strong>{l.to.name}</strong>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <Link href="/plan" className="btn btn-secondary">
        I&apos;m running late (open the plan)
      </Link>
    </div>
  );
}

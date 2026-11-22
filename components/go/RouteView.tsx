"use client";

import Link from "next/link";
import type { Segment, WalkSegment } from "@/lib/directions/segments";
import type { OsrmRoute } from "@/lib/osrm/types";
import { formatNY } from "@/lib/planner/time";
import { CHANGE_WALK_MIN } from "@/lib/transit/route";
import { LINE_COLOUR, familyOf, rideName } from "@/lib/transit/look";
import { towardText } from "@/lib/transit/text";
import LineChip from "@/components/LineChip";
import { DepChips, leaveInText } from "./Bits";
import type { ViewOption } from "./types";

type Props = {
  option: ViewOption;
  segments: Segment[];
  walks: Record<number, OsrmRoute | null | undefined>; // OSRM route per segment index (undefined = still loading)
  destName: string;
  now: Date;
  onBack: () => void;
};

function walkTitle(s: WalkSegment, destName: string): string {
  if (s.role === "to-station") return `Walk to ${s.leg.to}`;
  if (s.role === "between-stations") return `Walk to ${s.leg.to}`;
  return `Walk to ${destName}`;
}

// The route sheet: summary, next trains, then one simple step per line.
export default function RouteView({ option, segments, walks, destName, now, onBack }: Props) {
  const s = option.summary;
  const parts = [
    { label: "Walk", min: s.walkMin, cls: "bar-walk" },
    { label: "Wait", min: s.waitMin, cls: "bar-wait" },
    { label: option.mode === "car" ? "Drive" : "Ride", min: option.mode === "car" ? s.totalMin : s.rideMin, cls: "bar-ride" },
  ].filter((p) => p.min > 0);
  const total = parts.reduce((n, p) => n + p.min, 0) || 1;

  return (
    <div className="route-view">
      <button type="button" className="link-back" onClick={onBack}>
        ‹ All options
      </button>

      <section className="summary-card" aria-label="Summary">
        <div className="summary-times">
          <div>
            <small>Leave at</small>
            <strong>{formatNY(s.leaveAt)}</strong>
          </div>
          <div>
            <small>Arrive at</small>
            <strong>{formatNY(s.arriveAt)}</strong>
          </div>
          <div>
            <small>Total</small>
            <strong>{s.totalMin} min</strong>
          </div>
        </div>
        <div className="time-bar" role="img" aria-label={parts.map((p) => `${p.label} ${p.min} min`).join(", ")}>
          {parts.map((p) => (
            <span key={p.label} className={p.cls} style={{ flexGrow: p.min / total }} />
          ))}
        </div>
        <p className="bar-legend">
          {parts.map((p) => `${p.label} ${p.min} min`).join(" · ")}
          {" · "}
          {option.mode === "transit" && option.checked === "scheduled" ? "trains scheduled, walks estimated" : "estimate"}
        </p>
        <p className="leave-in" role="status">
          {leaveInText(s.leaveAt, now)}
        </p>
        <DepChips deps={option.deps} />
      </section>

      {option.plan.trainWarnings && option.plan.trainWarnings.length > 0 && (
        <div className="alert-loud" role="alert">
          <strong>Check the last train</strong>
          <ul>
            {option.plan.trainWarnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      {option.checked === "failed" && <p className="notice">Couldn&apos;t check train times. Please verify before you go.</p>}
      {option.alerts.length > 0 && (
        <details className="alerts">
          <summary>
            {option.alerts.length} MBTA {option.alerts.length === 1 ? "alert" : "alerts"} on these lines
          </summary>
          <ul>
            {option.alerts.map((a) => (
              <li key={a.id}>
                {a.lines.length > 0 && <strong>{a.lines.join(", ")}: </strong>}
                {a.text}
              </li>
            ))}
          </ul>
        </details>
      )}

      <ol className="route-steps">
        {option.mode === "car" && (
          <li className="rstep">
            <span className="rstep-icon icon-car" aria-hidden="true" />
            <div>
              <strong>Drive to {destName}</strong>
              <span className="soft">About {s.totalMin} min (estimate, without traffic). Parking not included.</span>
            </div>
          </li>
        )}
        {segments.map((seg, i) => {
          if (seg.kind === "walk") {
            const w = walks[i];
            return (
              <li key={i} className="rstep">
                <span className="rstep-icon icon-walk" aria-hidden="true" />
                <div>
                  <strong>{walkTitle(seg, destName)}</strong>
                  <span className="soft">
                    About {seg.leg.durationMin} min (estimate)
                    {w ? `, ${w.distanceM < 950 ? `${Math.round(w.distanceM / 10) * 10} m` : `${(w.distanceM / 1000).toFixed(1)} km`}` : ""}
                  </span>
                  {seg.entrance && (
                    <span className="soft">
                      {seg.role === "to-place" ? "Leave the station by" : "Station entrance"}: {seg.entrance}
                    </span>
                  )}
                  {w && w.steps.length > 0 ? (
                    <details className="rstep-more">
                      <summary>Turn-by-turn</summary>
                      <ol>
                        {w.steps.map((st, k) => (
                          <li key={k}>
                            {st.text}
                            <small> · {st.distanceM < 950 ? `${Math.round(st.distanceM / 10) * 10} m` : `${(st.distanceM / 1000).toFixed(1)} km`}</small>
                          </li>
                        ))}
                      </ol>
                    </details>
                  ) : w === undefined ? (
                    <span className="soft">Loading the walking directions…</span>
                  ) : (
                    <span className="soft">{seg.leg.instruction}</span>
                  )}
                </div>
              </li>
            );
          }
          const leg = seg.leg;
          const colour = LINE_COLOUR[familyOf(leg.routeIds)];
          const rideMin = leg.departAt && leg.arriveAt ? Math.round((new Date(leg.arriveAt).getTime() - new Date(leg.departAt).getTime()) / 60000) : leg.rideMin;
          return (
            <li key={i} className="rstep rstep-ride" style={{ ["--line" as string]: colour }}>
              <span className="rstep-icon icon-ride" aria-hidden="true" />
              <div>
                {leg.changeFrom && (
                  <span className="soft change-note">
                    Change to the {rideName(leg.routeIds)} at {leg.changeFrom}. About {CHANGE_WALK_MIN} min inside the station (estimate).
                  </span>
                )}
                <strong>
                  <LineChip routeIds={leg.routeIds} /> {rideName(leg.routeIds)} toward {towardText(leg.toward)}
                </strong>
                <span className="soft">
                  Board at {leg.boardAt}, platform: {leg.platform}
                  {leg.departAt ? `. Leaves ${formatNY(leg.departAt)} (scheduled)` : ""}
                </span>
                <span>
                  Ride {leg.stops} {leg.stops === 1 ? "stop" : "stops"}, {rideMin} min{leg.arriveAt ? " (scheduled)" : " (estimate)"}. Get off at {leg.getOffAt}.
                </span>
                {leg.lastWarning && <span className="option-warning">{leg.lastWarning}</span>}
                {seg.stations.length > 2 && (
                  <details className="rstep-more">
                    <summary>Stops</summary>
                    <ol className="stop-list">
                      {seg.stations.map((st) => (
                        <li key={st.id}>{st.name}</li>
                      ))}
                    </ol>
                  </details>
                )}
              </div>
            </li>
          );
        })}
        <li className="rstep">
          <span className="rstep-icon icon-end" aria-hidden="true" />
          <div>
            <strong>Arrive at {destName}</strong>
            <span className="soft">About {formatNY(s.arriveAt)}</span>
          </div>
        </li>
      </ol>

      <Link href="/plan" className="btn btn-secondary">
        I&apos;m running late (open the plan)
      </Link>
    </div>
  );
}

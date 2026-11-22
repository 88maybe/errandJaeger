import { formatNY } from "@/lib/planner/time";
import { buildTimeline, skippedNote } from "@/lib/planner/timeline";
import type { RoutePlan } from "@/lib/planner/types";
import type { LiveInfo } from "@/lib/transit/live";
import { LiveLine } from "./LiveTrip";
import LineChip from "./LineChip";
import TimeChip from "./TimeChip";

// The whole plan on one screen: summary, then walk, stop, walk, stop.
export default function Timeline({ plan, live }: { plan: RoutePlan; live?: Record<string, LiveInfo> }) {
  const items = buildTimeline(plan);
  const note = skippedNote(plan);

  return (
    <section>
      <div className="summary">
        <div>
          <span className="label">Leave by</span>
          <strong>{formatNY(plan.leaveBy)}</strong>
        </div>
        <div>
          <span className="label">{plan.backBy ? "Back by" : "Done about"}</span>
          <strong>{formatNY(plan.backBy ?? plan.endTime)}</strong>
        </div>
        <div>
          <span className="label">Total</span>
          <strong>~{plan.totalMin} min</strong>
        </div>
      </div>

      <ol className="rail">
        {items.map((item, i) => (
          <li key={i} className={`rail-item ${item.kind}`}>
            <div className="rail-time">
              {formatNY(item.startTime)} to {formatNY(item.endTime)}
              <TimeChip basis={item.basis} />
            </div>
            <strong>
              {item.kind === "transit" && item.routeIds && <LineChip routeIds={item.routeIds} />}
              {item.title}
            </strong>
            {item.kind === "transit" && live?.[item.startTime] && <LiveLine info={live[item.startTime]} />}
            {item.lines ? (
              <ul className="rail-facts">
                {item.lines.map((line, j) => (
                  <li key={j}>{line}</li>
                ))}
              </ul>
            ) : (
              <span>{item.detail}</span>
            )}
            {item.warning && (
              <p className="step-warning" role="alert">
                {item.warning}
              </p>
            )}
          </li>
        ))}
      </ol>

      {note && <p className="notice">{note}</p>}
      {items.some((i) => i.kind === "transit") && (
        <p className="soft">Train times marked Live or Scheduled come from the MBTA; the rest are estimates.</p>
      )}
      <p className="soft">Hours may vary, check before you go.</p>
    </section>
  );
}

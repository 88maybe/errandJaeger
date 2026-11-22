import { formatNY } from "@/lib/planner/time";
import { buildTimeline, skippedNote } from "@/lib/planner/timeline";
import type { RoutePlan } from "@/lib/planner/types";

// The whole plan on one screen: summary, then walk, stop, walk, stop.
export default function Timeline({ plan }: { plan: RoutePlan }) {
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
            </div>
            <strong>{item.title}</strong>
            {item.lines ? (
              <ul className="rail-facts">
                {item.lines.map((line, j) => (
                  <li key={j}>{line}</li>
                ))}
              </ul>
            ) : (
              <span>{item.detail}</span>
            )}
          </li>
        ))}
      </ol>

      {note && <p className="notice">{note}</p>}
      {items.some((i) => i.kind === "transit") && (
        <p className="soft">Train times are estimates. Live train times are not used yet, so check the MBTA before you go.</p>
      )}
      <p className="soft">Hours may vary, check before you go.</p>
    </section>
  );
}

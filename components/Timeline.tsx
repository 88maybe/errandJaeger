import { buildTimeline, emptyPlanMessage, skippedNote } from "@/lib/planner/timeline";
import { formatNY } from "@/lib/planner/time";
import type { RoutePlan } from "@/lib/planner/types";

export default function Timeline({ plan, onReset }: { plan: RoutePlan; onReset: () => void }) {
  const empty = emptyPlanMessage(plan);
  const note = skippedNote(plan);

  if (empty) {
    return (
      <section>
        <p className="kind-message">{empty}</p>
        <button type="button" className="primary" onClick={onReset}>
          Change my plan
        </button>
      </section>
    );
  }

  const items = buildTimeline(plan);

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

      <ol className="timeline">
        {items.map((item, i) => (
          <li key={i} className={`step ${item.kind}`}>
            <div className="when">
              {formatNY(item.startTime)}
              <span> to {formatNY(item.endTime)}</span>
            </div>
            <div className="what">
              <strong>{item.title}</strong>
              <span>{item.detail}</span>
            </div>
          </li>
        ))}
      </ol>

      {note && <p className="muted">{note}</p>}
      <p className="muted soft">Hours may vary, check before you go.</p>

      <button type="button" className="secondary" onClick={onReset}>
        Plan again
      </button>
    </section>
  );
}

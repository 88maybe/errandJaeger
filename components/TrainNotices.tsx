import type { RoutePlan } from "@/lib/planner/types";

// Everything about trains that needs your attention, shown at the top of the plan:
// loud last-train warnings, a soft "couldn't check" note, and a collapsible list of MBTA alerts.
export default function TrainNotices({ plan }: { plan: RoutePlan }) {
  const warnings = plan.trainWarnings ?? [];
  const alerts = plan.alerts ?? [];
  const failed = plan.trainCheck === "failed" || plan.trainCheck === "partial";

  if (warnings.length === 0 && alerts.length === 0 && !failed) return null;

  return (
    <div className="train-notices">
      {warnings.length > 0 && (
        <div className="alert-loud" role="alert">
          <strong>Check the last train</strong>
          <ul>
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {failed && <p className="notice">Couldn&apos;t check train times. Please verify before you go.</p>}

      {alerts.length > 0 && (
        <details className="alerts">
          <summary>
            {alerts.length} MBTA {alerts.length === 1 ? "alert" : "alerts"} on your lines
          </summary>
          <ul>
            {alerts.map((a) => (
              <li key={a.id}>
                {a.lines.length > 0 && <strong>{a.lines.join(", ")}: </strong>}
                {a.text}
              </li>
            ))}
          </ul>
          <p className="soft">As of when you made this plan. Check the MBTA before you go.</p>
        </details>
      )}
    </div>
  );
}

import Link from "next/link";
import { formatNY } from "@/lib/planner/time";
import { buildSteps } from "@/lib/planner/timeline";
import type { Basis, RoutePlan } from "@/lib/planner/types";
import type { LiveInfo } from "@/lib/transit/live";
import { LiveLine } from "./LiveTrip";
import LineChip from "./LineChip";
import { familyOf, LINE_COLOUR } from "@/lib/transit/look";
import TimeChip from "./TimeChip";

type Step = { kind: "start" | "walk" | "stop" | "transit" | "end"; title: string; detail: string; time?: string; warning?: string; basis?: Basis; liveKey?: string; routeIds?: string[] };

// One big step at a time, with Back and Next.
export default function StepView({
  plan,
  step,
  actions,
  live,
  onStep,
}: {
  plan: RoutePlan;
  step: number;
  actions?: string[]; // AI one-action wording per step (empty string = use the standard text)
  live?: Record<string, LiveInfo>;
  onStep: (n: number) => void;
}) {
  const steps: Step[] = [
    { kind: "start", title: `Start from ${plan.start.name}`, detail: `Leave at ${formatNY(plan.leaveBy)}.` },
    ...buildSteps(plan).map((item, i) => ({
      kind: item.kind,
      title: item.title,
      detail: actions?.[i] || item.detail, // simple action if we have one, else the standard text
      warning: item.warning,
      basis: item.basis,
      routeIds: item.routeIds,
      liveKey: item.kind === "transit" && item.title.startsWith("Ride") ? undefined : item.startTime,
      time: `${formatNY(item.startTime)} to ${formatNY(item.endTime)}`,
    })),
    { kind: "end", title: "That's everything", detail: "Open your bingo card to tick things off." },
  ];

  const index = Math.min(Math.max(step, 0), steps.length - 1);
  const current = steps[index];
  const last = index === steps.length - 1;

  return (
    <section>
      <p className="step-count">
        Step {index + 1} of {steps.length}
      </p>
      {/* Progress drawn like stops on a subway line: rides take their line colour, stops are Green. */}
      <ol
        className={`subway ${steps.length > 12 ? "many" : ""}`}
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={index + 1}
        aria-label={`Step ${index + 1} of ${steps.length}`}
        style={{ ["--done" as string]: `calc((100% - 20px) * ${steps.length > 1 ? index / (steps.length - 1) : 0})` }}
      >
        {steps.map((st, i) => (
          <li
            key={i}
            className={`stop-${st.kind} ${i < index ? "passed" : ""} ${i === index ? "here" : ""}`}
            style={st.routeIds ? { ["--stop-colour" as string]: LINE_COLOUR[familyOf(st.routeIds)] } : undefined}
          />
        ))}
      </ol>

      <div className={`step-card ${current.kind}`}>
        {current.time && (
          <p className="step-time">
            {current.time}
            {current.basis && <TimeChip basis={current.basis} />}
          </p>
        )}
        <h2 className="step-title">
          {current.routeIds && <LineChip routeIds={current.routeIds} />} {current.title}
        </h2>
        <p className="step-detail">{current.detail}</p>
        {current.kind === "transit" && current.liveKey && live?.[current.liveKey] && <LiveLine info={live[current.liveKey]} />}
        {current.warning && (
          <p className="step-warning" role="alert">
            {current.warning}
          </p>
        )}
      </div>

      <div className="step-buttons">
        <button type="button" className="btn btn-secondary" disabled={index === 0} onClick={() => onStep(index - 1)}>
          Back
        </button>
        {last ? (
          <Link href="/bingo" className="btn btn-primary">
            Open bingo
          </Link>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => onStep(index + 1)}>
            Next
          </button>
        )}
      </div>
    </section>
  );
}

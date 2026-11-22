import Link from "next/link";
import { formatNY } from "@/lib/planner/time";
import { buildTimeline } from "@/lib/planner/timeline";
import type { RoutePlan } from "@/lib/planner/types";

type Step = { kind: "start" | "walk" | "stop" | "end"; title: string; detail: string; time?: string };

// One big step at a time, with Back and Next.
export default function StepView({ plan, step, onStep }: { plan: RoutePlan; step: number; onStep: (n: number) => void }) {
  const steps: Step[] = [
    { kind: "start", title: `Start from ${plan.start.name}`, detail: `Leave at ${formatNY(plan.leaveBy)}.` },
    ...buildTimeline(plan).map((item) => ({
      kind: item.kind,
      title: item.title,
      detail: item.detail,
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
      <div className="progress" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={index + 1}>
        <div style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
      </div>

      <div className={`step-card ${current.kind}`}>
        {current.time && <p className="step-time">{current.time}</p>}
        <h2 className="step-title">{current.title}</h2>
        <p className="step-detail">{current.detail}</p>
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

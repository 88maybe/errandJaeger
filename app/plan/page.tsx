"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import StepView from "@/components/StepView";
import Timeline from "@/components/Timeline";
import TrainNotices from "@/components/TrainNotices";
import { aiActions } from "@/lib/ai/client";
import { shortName } from "@/lib/bingo";
import { formatNY } from "@/lib/planner/time";
import { buildSteps } from "@/lib/planner/timeline";
import { useOuting } from "@/lib/useOuting";

export default function PlanPage() {
  const { outing, loaded, update } = useOuting();
  // Calmer mode opens on the one-step view. You can switch either way.
  const [view, setView] = useState<"overview" | "steps" | null>(null);
  const [simplifying, setSimplifying] = useState(false); // AI is rewriting the steps
  const tried = useRef(false);

  // Calmer mode: once per outing, ask the AI for one simple action per step. If it can't, the standard steps stay.
  useEffect(() => {
    if (!loaded || !outing || outing.mode !== "calm" || outing.ai?.steps || tried.current) return;
    tried.current = true;
    const items = buildSteps(outing.plan).map((item, index) => ({
      index,
      kind: item.kind,
      place: shortName(item.place),
      // Everything the AI is allowed to use: the planner's own words and times.
      text: `${item.title}. ${item.detail} ${formatNY(item.startTime)} to ${formatNY(item.endTime)}.`,
      keep: item.keep,
    }));
    setSimplifying(true);
    aiActions(items).then((actions) => {
      setSimplifying(false);
      update((prev) => ({
        ...prev,
        ai: {
          ...prev.ai,
          steps: actions ? "done" : "failed",
          actions: actions ? items.map((_, i) => actions[i] ?? "") : undefined,
        },
      }));
    });
  }, [loaded, outing, update]);

  if (!loaded) return <p className="soft">Loading…</p>;

  if (!outing) {
    return (
      <main>
        <h1 className="page-title">Your plan</h1>
        <div className="card empty">
          <p>No plan yet. Pick what you need and we&apos;ll build one.</p>
          <Link href="/" className="btn btn-primary">
            Make a plan
          </Link>
        </div>
      </main>
    );
  }

  const activeView = view ?? (outing.mode === "calm" ? "steps" : "overview");

  return (
    <main>
      <h1 className="page-title">Your plan</h1>
      <p className="starting">
        Starting from: <strong>{outing.plan.start.name}</strong>
      </p>

      <TrainNotices plan={outing.plan} />

      <div className="segmented" role="group" aria-label="How to see your plan">
        <button type="button" aria-pressed={activeView === "overview"} onClick={() => setView("overview")}>
          Overview
        </button>
        <button type="button" aria-pressed={activeView === "steps"} onClick={() => setView("steps")}>
          One step at a time
        </button>
      </div>

      {activeView === "overview" ? (
        <>
          <Timeline plan={outing.plan} />
          <Link href="/bingo" className="btn btn-primary">
            Open my bingo card
          </Link>
        </>
      ) : (
        <>
          {simplifying && <p className="soft">Making each step simpler…</p>}
          {!simplifying && outing.mode === "calm" && outing.ai?.steps === "failed" && (
            <p className="soft">Using the standard steps.</p>
          )}
          <StepView
            plan={outing.plan}
            step={outing.step}
            actions={outing.ai?.actions}
            onStep={(n) => update((prev) => ({ ...prev, step: n }))}
          />
        </>
      )}
    </main>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import StepView from "@/components/StepView";
import Timeline from "@/components/Timeline";
import { useOuting } from "@/lib/useOuting";

export default function PlanPage() {
  const { outing, loaded, update } = useOuting();
  // Calmer mode opens on the one-step view. You can switch either way.
  const [view, setView] = useState<"overview" | "steps" | null>(null);

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
        <StepView plan={outing.plan} step={outing.step} onStep={(n) => update({ ...outing, step: n })} />
      )}
    </main>
  );
}

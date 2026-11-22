"use client";

import { useState } from "react";
import PlanForm, { type FormValues } from "@/components/PlanForm";
import Timeline from "@/components/Timeline";
import { planRoute } from "@/lib/planner";
import { PLACES } from "@/lib/planner/places";
import { todayAtNY } from "@/lib/planner/time";
import type { RoutePlan } from "@/lib/planner/types";

export default function Home() {
  const [plan, setPlan] = useState<RoutePlan | null>(null);

  // Run the planner with what the form gave us.
  function makePlan(values: FormValues) {
    const result = planRoute(
      {
        needs: values.needs,
        startTime: todayAtNY(values.startHHMM),
        loop: values.loop,
        mode: values.calm ? "calm" : "normal",
      },
      PLACES,
    );
    setPlan(result);
  }

  return (
    <main className="page">
      <h1>errandJaeger</h1>
      <p className="muted">Turn today&apos;s Boston errands into a calmer bingo walk.</p>
      {plan ? <Timeline plan={plan} onReset={() => setPlan(null)} /> : <PlanForm onSubmit={makePlan} />}
    </main>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import PlanForm, { type FormValues } from "@/components/PlanForm";
import { buildCard } from "@/lib/bingo";
import { planRoute } from "@/lib/planner";
import { PLACES } from "@/lib/planner/places";
import { todayAtNY } from "@/lib/planner/time";
import { emptyPlanMessage } from "@/lib/planner/timeline";
import { getOuting, getPrefs, saveOuting, savePrefs, type Outing, type Prefs } from "@/lib/storage";

export default function Home() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [current, setCurrent] = useState<Outing | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Load what we remembered: your last choices, and any plan in progress.
  useEffect(() => {
    getPrefs().then(setPrefs);
    getOuting().then(setCurrent);
  }, []);

  async function makePlan(values: FormValues) {
    // Remember the choices, so coming back keeps them.
    await savePrefs({ needs: values.needs, loop: values.loop, calm: values.calm, start: values.start });

    const mode = values.calm ? "calm" : "normal";
    const plan = planRoute(
      { needs: values.needs, startTime: todayAtNY(values.startHHMM), loop: values.loop, mode, start: values.start },
      PLACES,
    );

    // Nothing fits: show the kind message here, and keep any plan already in progress.
    const empty = emptyPlanMessage(plan);
    if (empty) {
      setMessage(empty);
      return;
    }

    const id = Date.now().toString(36);
    await saveOuting({ id, createdAt: new Date().toISOString(), mode, plan, card: buildCard(plan, id), ticked: [], step: 0 });
    router.push("/plan");
  }

  return (
    <main>
      <header className="brand">
        <h1>errandJaeger</h1>
        <p>Turn today&apos;s errands into a calmer bingo walk.</p>
      </header>

      {current && (
        <Link href="/plan" className="card resume">
          <strong>You have a plan in progress</strong>
          <span>
            {current.plan.stops.length} stops from {current.plan.start.name}. Continue
          </span>
        </Link>
      )}

      {prefs ? <PlanForm initial={prefs} onSubmit={makePlan} /> : <p className="soft">Loading…</p>}

      {message && (
        <p className="kind-message" role="status">
          {message}
        </p>
      )}
    </main>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import PlanForm, { type FormValues } from "@/components/PlanForm";
import { buildCard } from "@/lib/bingo";
import { planRoute } from "@/lib/planner";
import { PLACES } from "@/lib/planner/places";
import { todayAtNY } from "@/lib/planner/time";
import { applyTrainData } from "@/lib/planner/schedule";
import { emptyPlanMessage } from "@/lib/planner/timeline";
import type { RoutePlan } from "@/lib/planner/types";
import { fetchTrainData } from "@/lib/transit/client";
import type { Departures } from "@/lib/planner/schedule";
import { getOuting, getPrefs, saveOuting, savePrefs, type Outing, type Prefs } from "@/lib/storage";

// "Leave now": this moment, rounded down to the minute.
const startOfThisMinute = () => new Date(Math.floor(Date.now() / 60000) * 60000);

export default function Home() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [current, setCurrent] = useState<Outing | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [checking, setChecking] = useState(false); // looking up real train times
  // A finished new plan waiting for you to say "replace my current one".
  const [waiting, setWaiting] = useState<{ plan: RoutePlan; mode: "normal" | "calm"; train?: Departures } | null>(null);

  // Load what we remembered: your last choices, and any plan in progress.
  useEffect(() => {
    getPrefs().then(setPrefs);
    getOuting().then(setCurrent);
  }, []);

  async function saveAndGo(plan: RoutePlan, mode: "normal" | "calm", train?: Departures) {
    const id = Date.now().toString(36);
    await saveOuting({ id, createdAt: new Date().toISOString(), mode, plan, card: buildCard(plan, id), ticked: [], step: 0, train });
    router.push("/plan");
  }

  async function makePlan(values: FormValues) {
    // Remember the choices, so coming back keeps them.
    await savePrefs({ needs: values.needs, loop: values.loop, calm: values.calm, start: values.start });
    setWaiting(null);

    const mode = values.calm ? "calm" : "normal";
    const estimated = planRoute(
      { needs: values.needs, startTime: values.leaveNow ? startOfThisMinute() : todayAtNY(values.startHHMM), loop: values.loop, mode, start: values.start },
      PLACES,
    );

    // Nothing fits: show the kind message here, and keep any plan already in progress.
    const empty = emptyPlanMessage(estimated);
    if (empty) {
      setMessage(empty);
      return;
    }
    setMessage(null);

    // Train rides: swap the estimated waits for the real scheduled times. If the lookup fails, the plan still works.
    let plan = estimated;
    let train: Departures | undefined;
    if (estimated.legs.some((l) => l.type === "transit")) {
      setChecking(true);
      const data = await fetchTrainData(estimated);
      plan = applyTrainData(estimated, data);
      train = data?.departures; // saved, so "I'm running late" can re-time without asking again
      setChecking(false);
    } else {
      plan = applyTrainData(estimated, null);
    }

    // A plan is already in progress: ask before replacing it.
    if (current) {
      setWaiting({ plan, mode, train });
      return;
    }
    await saveAndGo(plan, mode, train);
  }

  return (
    <main>
      <header className="brand">
        <h1>errandJaeger</h1>
        <p>Turn today&apos;s errands into a calmer bingo walk.</p>
      </header>

      {current && !waiting && (
        <Link href="/plan" className="card resume">
          <strong>You have a plan in progress</strong>
          <span>
            {current.plan.stops.length} stops from {current.plan.start.name}. Continue
          </span>
        </Link>
      )}

      {waiting && (
        <div className="card confirm" role="alertdialog" aria-labelledby="replace-title">
          <strong id="replace-title">Replace your plan in progress?</strong>
          <p>Your new plan is ready. Making it will replace the plan you already started, and its bingo ticks.</p>
          <div className="confirm-buttons">
            <button type="button" className="btn btn-secondary" onClick={() => router.push("/plan")}>
              Keep my current plan
            </button>
            <button type="button" className="btn btn-primary" onClick={() => saveAndGo(waiting.plan, waiting.mode, waiting.train)}>
              Replace it
            </button>
          </div>
        </div>
      )}

      {prefs ? <PlanForm initial={prefs} onSubmit={makePlan} /> : <p className="soft">Loading…</p>}

      {checking && (
        <p className="soft" role="status">
          Checking train times…
        </p>
      )}

      {message && (
        <p className="kind-message" role="status">
          {message}
        </p>
      )}
    </main>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChangeCard, LatePanel, NowCard } from "@/components/LiveTrip";
import StepView from "@/components/StepView";
import Timeline from "@/components/Timeline";
import TrainNotices from "@/components/TrainNotices";
import { aiActions } from "@/lib/ai/client";
import { shortName } from "@/lib/bingo";
import { dropStop, missedTrain, runningLate, type Replanned } from "@/lib/planner/replan";
import { retimePlan } from "@/lib/planner/schedule";
import { formatNY } from "@/lib/planner/time";
import { buildSteps } from "@/lib/planner/timeline";
import { fetchTrainData } from "@/lib/transit/client";
import { useLive } from "@/lib/useLive";
import { useOuting } from "@/lib/useOuting";
import type { Outing } from "@/lib/storage";

export default function PlanPage() {
  const { outing, loaded, update } = useOuting();
  // Calmer mode opens on the one-step view. You can switch either way.
  const [view, setView] = useState<"overview" | "steps" | null>(null);
  const [simplifying, setSimplifying] = useState(false); // AI is rewriting the steps
  const [busy, setBusy] = useState(false); // re-timing the plan
  const tried = useRef("");
  const live = useLive(outing?.plan ?? null, !!outing && !outing.finishedAt, outing?.train);

  // Calmer mode: once per version of the plan, ask the AI for one simple action per step. If it can't, the standard steps stay.
  useEffect(() => {
    if (!loaded || !outing || outing.mode !== "calm" || outing.ai?.steps) return;
    const version = `${outing.id}:${outing.rev ?? 0}`;
    if (tried.current === version) return;
    tried.current = version;
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
      update((prev) => {
        if (`${prev.id}:${prev.rev ?? 0}` !== version) return prev; // the plan moved on while we waited
        return {
          ...prev,
          ai: {
            ...prev.ai,
            steps: actions ? "done" : "failed",
            actions: actions ? items.map((_, i) => actions[i] ?? "") : undefined,
          },
        };
      });
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

  // The plan changed: save it, forget old AI wording (it has old times), and remember what changed.
  function applyReplan(prev: Outing, r: Replanned, extra: string[] = [], card = prev.card): Outing {
    const lines = [...extra, ...r.changes, ...(r.note ? [r.note] : [])];
    return {
      ...prev,
      plan: r.plan,
      card,
      rev: (prev.rev ?? 0) + 1,
      ai: { ...prev.ai, steps: undefined, actions: undefined },
      change: { lines: lines.length > 0 ? lines : ["Nothing else needed to change."], dropIds: r.closed, at: new Date().toISOString() },
    };
  }

  function onLate(kind: 5 | 10 | 15 | "missed") {
    if (!outing) return;
    const now = new Date();
    const r = kind === "missed" ? missedTrain(outing.plan, outing.train ?? null, now) : runningLate(outing.plan, outing.train ?? null, now, kind);
    update((prev) => applyReplan(prev, r));
  }

  async function onDrop(placeId: string) {
    if (!outing) return;
    const name = outing.plan.stops.find((s) => s.place.id === placeId)?.place.name ?? "that stop";
    setBusy(true);
    const dropped = dropStop(outing.plan, placeId, new Date(), outing.mode);
    if (!dropped) {
      setBusy(false);
      return;
    }
    // New train rides may need schedule data we don't have yet.
    const fresh = await fetchTrainData(dropped.plan);
    const merged = { ...(outing.train ?? {}), ...(fresh?.departures ?? {}) };
    const r = retimePlan(dropped.plan, merged, { events: dropped.events, fromIndex: dropped.fromIndex, cursor: dropped.cursor });
    // Its bingo square becomes a gentle extra, so the card can still be finished.
    const card = outing.card.map((sq) => (sq.id === `stop-${placeId}` ? { id: sq.id, kind: "extra" as const, label: "Take a moment to look around" } : sq));
    update((prev) => ({ ...applyReplan(prev, r, [`Dropped ${name}.`], card), train: merged }));
    setBusy(false);
  }

  // Every stop was dropped: say so kindly and point back to Home.
  if (outing.plan.stops.length === 0) {
    return (
      <main>
        <h1 className="page-title">Your plan</h1>
        <div className="card empty">
          <p>That was your last stop. Want to add something else?</p>
          <Link href="/" className="btn btn-primary">
            Back to Home
          </Link>
        </div>
      </main>
    );
  }

  const activeView = view ?? (outing.mode === "calm" ? "steps" : "overview");
  const change = outing.change;
  const hasTrains = outing.plan.legs.some((l) => l.type === "transit");
  const drops = (change?.dropIds ?? []).flatMap((id) => {
    const s = outing.plan.stops.find((st) => st.place.id === id);
    return s ? [{ id, name: shortName(s.place.name) }] : [];
  });

  return (
    <main>
      <h1 className="page-title">Your plan</h1>
      <p className="starting">
        Starting from: <strong>{outing.plan.start.name}</strong>
      </p>

      <TrainNotices plan={outing.plan} />

      {!outing.finishedAt && outing.plan.stops.length > 0 && (
        <Link href="/go" className="btn btn-secondary directions-link">
          Directions to the next stop (transit, walk or car)
        </Link>
      )}

      {!outing.finishedAt && <NowCard plan={outing.plan} live={live} />}

      {change && (
        <ChangeCard
          lines={change.lines}
          drops={drops}
          busy={busy}
          onDrop={onDrop}
          onDismiss={() => update((prev) => ({ ...prev, change: undefined }))}
        />
      )}

      {!outing.finishedAt && <LatePanel onLate={onLate} busy={busy} />}

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
          <Timeline plan={outing.plan} live={hasTrains ? live.infos : undefined} />
          <Link href="/bingo" className="btn btn-primary">
            Open my bingo card
          </Link>
        </>
      ) : (
        <>
          {simplifying && <p className="soft">Making each step simpler…</p>}
          {!simplifying && outing.mode === "calm" && outing.ai?.steps === "failed" && <p className="soft">Using the standard steps.</p>}
          <StepView
            plan={outing.plan}
            step={outing.step}
            actions={outing.ai?.actions}
            live={hasTrains ? live.infos : undefined}
            onStep={(n) => update((prev) => ({ ...prev, step: n }))}
          />
        </>
      )}
    </main>
  );
}

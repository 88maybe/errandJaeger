"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import BingoCard from "@/components/BingoCard";
import { aiBingoLabels } from "@/lib/ai/client";
import { completedLines, isFullCard } from "@/lib/bingo";
import { replanFromTick } from "@/lib/planner/replan";
import { finishOuting } from "@/lib/storage";
import { useOuting } from "@/lib/useOuting";

export default function BingoPage() {
  const router = useRouter();
  const { outing, loaded, update } = useOuting();
  const [banner, setBanner] = useState<string | null>(null);
  const [askEmpty, setAskEmpty] = useState(false); // "finish with nothing ticked?" confirm
  const [wording, setWording] = useState(false); // AI is reading the square names
  const [retimed, setRetimed] = useState(false); // we just re-timed the plan after a tick
  const tried = useRef(false);

  // Once per outing, ask the AI to make the stop names friendlier. If it can't, the plain names stay.
  useEffect(() => {
    if (!loaded || !outing || outing.ai?.bingo || tried.current) return;
    const stops = outing.card
      .filter((s) => s.kind === "stop" && s.place)
      .map((s) => ({
        id: s.id,
        place: s.place as string,
        need: outing.plan.stops.find((st) => `stop-${st.place.id}` === s.id)?.need ?? "activity",
      }));
    if (stops.length === 0) return;
    tried.current = true;
    setWording(true);
    aiBingoLabels(stops).then((labels) => {
      setWording(false);
      update((prev) => ({
        ...prev,
        card: labels ? prev.card.map((s) => (labels[s.id] ? { ...s, label: labels[s.id] } : s)) : prev.card,
        ai: { ...prev.ai, bingo: labels ? "done" : "failed" },
      }));
    });
  }, [loaded, outing, update]);

  if (!loaded) return <p className="soft">Loading…</p>;

  if (!outing) {
    return (
      <main>
        <h1 className="page-title">Bingo</h1>
        <div className="card empty">
          <p>Your bingo card appears once you have a plan.</p>
          <Link href="/" className="btn btn-primary">
            Make a plan
          </Link>
        </div>
      </main>
    );
  }

  function tap(index: number) {
    if (!outing) return;
    const wasTicked = outing.ticked.includes(index);
    const ticked = wasTicked ? outing.ticked.filter((i) => i !== index) : [...outing.ticked, index];

    // Celebrate only when this tap finishes something new.
    const linesBefore = completedLines(outing.card, outing.ticked).length;
    const linesAfter = completedLines(outing.card, ticked).length;
    if (!wasTicked && isFullCard(outing.card, ticked)) setBanner("Full card! You did the whole walk.");
    else if (!wasTicked && linesAfter > linesBefore) setBanner("A line! Nicely done.");
    else setBanner(null);

    // Ticking a stop re-times the rest of the plan from this moment.
    const square = outing.card[index];
    const stopId = !wasTicked && square.kind === "stop" ? square.id.replace(/^stop-/, "") : null;
    const r = stopId && !outing.finishedAt ? replanFromTick(outing.plan, outing.train ?? null, stopId, new Date()) : null;
    if (r) setRetimed(true);
    update((prev) =>
      r
        ? {
            ...prev,
            ticked,
            plan: r.plan,
            rev: (prev.rev ?? 0) + 1,
            ai: { ...prev.ai, steps: undefined, actions: undefined },
            change: { lines: ["Re-timed from now.", ...r.changes], dropIds: r.closed, at: new Date().toISOString() },
          }
        : { ...prev, ticked },
    );
    setAskEmpty(false);
  }

  async function finish() {
    if (!outing) return;
    // Nothing ticked: ask gently first, because an empty outing does not count toward stats.
    if (outing.ticked.length === 0 && !askEmpty) {
      setAskEmpty(true);
      return;
    }
    const counted = await finishOuting();
    router.push(counted ? "/done" : "/");
  }

  return (
    <main>
      <h1 className="page-title">Bingo</h1>
      <p className="starting">{outing.ticked.length} of 8 ticked. Tap a square when you&apos;ve done it.</p>
      {wording && <p className="soft">Making the square names friendlier…</p>}
      {!wording && outing.ai?.bingo === "failed" && <p className="soft">Using the simple square names.</p>}

      {banner && (
        <div className="banner" role="status">
          <span>{banner}</span>
          <button type="button" onClick={() => setBanner(null)} aria-label="Dismiss">
            OK
          </button>
        </div>
      )}

      {retimed && (
        <p className="soft" role="status">
          Plan re-timed from now. <Link href="/plan">See what changed</Link>.
        </p>
      )}

      <BingoCard card={outing.card} ticked={outing.ticked} onTap={tap} />

      {askEmpty && (
        <div className="card confirm" role="alertdialog" aria-labelledby="empty-title">
          <strong id="empty-title">Nothing ticked yet</strong>
          <p>If you finish now, this outing won&apos;t count toward your stats or streak. That&apos;s okay.</p>
          <div className="confirm-buttons">
            <button type="button" className="btn btn-secondary" onClick={() => setAskEmpty(false)}>
              Keep going
            </button>
            <button type="button" className="btn btn-primary" onClick={finish}>
              Finish anyway
            </button>
          </div>
        </div>
      )}

      {!askEmpty && (
        <button type="button" className="btn btn-secondary" onClick={finish}>
          Finish outing
        </button>
      )}
    </main>
  );
}

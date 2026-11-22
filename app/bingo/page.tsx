"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import BingoCard from "@/components/BingoCard";
import { completedLines, isFullCard } from "@/lib/bingo";
import { finishOuting } from "@/lib/storage";
import { useOuting } from "@/lib/useOuting";

export default function BingoPage() {
  const router = useRouter();
  const { outing, loaded, update } = useOuting();
  const [banner, setBanner] = useState<string | null>(null);

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

    update({ ...outing, ticked });
  }

  async function finish() {
    await finishOuting();
    router.push("/done");
  }

  const doneCount = outing.ticked.length;

  return (
    <main>
      <h1 className="page-title">Bingo</h1>
      <p className="starting">
        {doneCount} of 8 ticked. Tap a square when you&apos;ve done it.
      </p>

      {banner && (
        <div className="banner" role="status">
          <span>{banner}</span>
          <button type="button" onClick={() => setBanner(null)} aria-label="Dismiss">
            OK
          </button>
        </div>
      )}

      <BingoCard card={outing.card} ticked={outing.ticked} onTap={tap} />

      <button type="button" className="btn btn-secondary" onClick={finish}>
        Finish outing
      </button>
    </main>
  );
}

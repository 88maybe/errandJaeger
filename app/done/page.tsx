"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import RankCard from "@/components/RankCard";
import StatsCards from "@/components/StatsCards";
import { rankFor } from "@/lib/profile";
import { computeStats, rewardMessage, type Stats } from "@/lib/stats";
import { getHistory, type Outing } from "@/lib/storage";

export default function DonePage() {
  const [loaded, setLoaded] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [last, setLast] = useState<Outing | undefined>();

  useEffect(() => {
    getHistory().then((history) => {
      setStats(computeStats(history));
      setLast(history[history.length - 1]);
      setLoaded(true);
    });
  }, []);

  if (!loaded || !stats) return <p className="soft">Loading…</p>;

  if (!last) {
    return (
      <main>
        <h1 className="page-title">All done</h1>
        <div className="card empty">
          <p>No finished outing yet.</p>
          <Link href="/" className="btn btn-primary">
            Make a plan
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main>
      <h1 className="page-title">Outing done</h1>
      <p className="reward">{rewardMessage(stats, last)}</p>
      {stats.outings > 0 && rankFor(stats.outings).min === stats.outings && (
        <p className="rank-up" role="status">
          New rank: {rankFor(stats.outings).name}
        </p>
      )}
      <RankCard outings={stats.outings} />
      <StatsCards stats={stats} />
      <Link href="/" className="btn btn-primary">
        Back home
      </Link>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import StatsCards from "@/components/StatsCards";
import { formatDateNY } from "@/lib/planner/time";
import { computeStats, type Stats } from "@/lib/stats";
import { getHistory, type Outing } from "@/lib/storage";

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<Outing[]>([]);

  useEffect(() => {
    getHistory().then((history) => {
      setStats(computeStats(history));
      setRecent(history.slice(-5).reverse());
    });
  }, []);

  if (!stats) return <p className="soft">Loading…</p>;

  return (
    <main>
      <h1 className="page-title">Your stats</h1>
      <StatsCards stats={stats} />

      <h2>Recent outings</h2>
      {recent.length === 0 ? (
        <p className="soft">Nothing yet. Your first finished outing will show up here.</p>
      ) : (
        <ul className="recent">
          {recent.map((o) => (
            <li key={o.id} className="card">
              <strong>{formatDateNY(o.finishedAt ?? o.createdAt)}</strong>
              <span>
                from {o.plan.start.name}, {o.ticked.filter((i) => o.card[i]?.kind === "stop").length} of {o.plan.stops.length} stops
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

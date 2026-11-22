"use client";

import { Skeleton } from "@/components/Busy";
import { useEffect, useState } from "react";
import Link from "next/link";
import RankCard from "@/components/RankCard";
import ThemeToggle from "@/components/ThemeToggle";
import StatsCards from "@/components/StatsCards";
import { BADGES, badgeCounts } from "@/lib/profile";
import { formatDateNY } from "@/lib/planner/time";
import { computeStats, type Stats } from "@/lib/stats";
import { getHistory, type Outing } from "@/lib/storage";

// Your profile: rank, streak and totals, badges for noticing things, and recent outings.
export default function ProfilePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [badges, setBadges] = useState<Record<string, number>>({});
  const [recent, setRecent] = useState<Outing[]>([]);

  useEffect(() => {
    getHistory().then((history) => {
      setStats(computeStats(history));
      setBadges(badgeCounts(history));
      setRecent(history.filter((o) => o.finishedAt).slice(-5).reverse());
    });
  }, []);

  if (!stats) return <Skeleton rows={2} label="Loading" />;
  const earned = BADGES.filter((b) => badges[b.square]).length;

  return (
    <main>
      <h1 className="page-title">Your profile</h1>
      <RankCard outings={stats.outings} />
      <StatsCards stats={stats} />

      <h2>
        Badges <span className="soft-inline">{earned} of {BADGES.length}</span>
      </h2>
      <p className="soft">For noticing the world: tick these squares on a bingo card.</p>
      <ul className="badges">
        {BADGES.map((b) => {
          const n = badges[b.square] ?? 0;
          return (
            <li key={b.name} className={`badge ${n ? "earned" : ""}`}>
              <span className="badge-icon" aria-hidden="true">
                {b.icon}
              </span>
              <strong>{b.name}</strong>
              <small>{n ? `${n}×` : b.square}</small>
            </li>
          );
        })}
      </ul>

      <h2>Recent outings</h2>
      {recent.length === 0 ? (
        <div className="empty-state">
          <p>Nothing yet. Make a plan, tick a square, then press Finish outing: it will show up here.</p>
          <Link href="/" className="btn btn-primary btn-small">
            Make a plan
          </Link>
        </div>
      ) : (
        <ul className="recent">
          {recent.map((o) => (
            <li key={o.id} className="card">
              <strong>{formatDateNY(o.finishedAt ?? o.createdAt)}</strong>
              <span>
                {o.plan.stops.length} {o.plan.stops.length === 1 ? "stop" : "stops"} from {o.plan.start.name}
                {o.bingo === false ? " · no bingo" : ` · ${o.ticked.length} squares`}
              </span>
            </li>
          ))}
        </ul>
      )}
      <h2>Appearance</h2>
      <p className="soft">Light is the default. Auto follows your phone.</p>
      <ThemeToggle />

      <p className="soft">Saved on this phone{" "}(and in the app&apos;s database when one is set up). No account needed.</p>
    </main>
  );
}

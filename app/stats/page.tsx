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
import { stopGroup, type GroupId } from "@/lib/groups";

const LAST_GROUPS: { id: GroupId; label: string }[] = [
  { id: "errands", label: "Errand" },
  { id: "treats", label: "Treat" },
  { id: "wellbeing", label: "Wellbeing" },
];

type LastVisit = { place: string; when: string; tripMin: number; places: number };

// The most recent finished trip that had a stop of each group.
function lastVisits(history: Outing[]): Partial<Record<GroupId, LastVisit>> {
  const out: Partial<Record<GroupId, LastVisit>> = {};
  const done = history.filter((o) => o.finishedAt).sort((a, b) => Date.parse(b.finishedAt as string) - Date.parse(a.finishedAt as string));
  for (const o of done) {
    const tickedIds = new Set(o.ticked.map((i) => o.card[i]?.id));
    const hit = o.bingo === false ? o.plan.stops : o.plan.stops.filter((s) => tickedIds.has(`stop-${s.place.id}`));
    const placesHit = (hit.length > 0 ? hit : o.plan.stops).length;
    for (const s of [...o.plan.stops].reverse()) {
      const g = stopGroup(s);
      if (out[g]) continue;
      out[g] = { place: s.place.name, when: o.finishedAt as string, tripMin: o.plan.totalMin, places: placesHit };
    }
  }
  return out;
}

function ago(iso: string): string {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

// Your profile: rank, streak and totals, badges for noticing things, and the last place in each group.
export default function ProfilePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [badges, setBadges] = useState<Record<string, number>>({});
  const [last, setLast] = useState<Partial<Record<GroupId, LastVisit>>>({});

  useEffect(() => {
    getHistory().then((history) => {
      setStats(computeStats(history));
      setBadges(badgeCounts(history));
      setLast(lastVisits(history));
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

      <h2>Last visited</h2>
      {Object.keys(last).length === 0 ? (
        <div className="empty-state">
          <p>Nothing yet. Make a plan, go, then press Finish outing: your last errand, treat and wellbeing stop will show up here.</p>
          <Link href="/" className="btn btn-primary btn-small">
            Plan a trip
          </Link>
        </div>
      ) : (
        <ul className="last-visited">
          {LAST_GROUPS.map((g) => {
            const v = last[g.id];
            return (
              <li key={g.id} className={`card last-${g.id}`}>
                <span className="last-label">{g.label}</span>
                {v ? (
                  <>
                    <strong>{v.place}</strong>
                    <span className="soft">
                      {formatDateNY(v.when)} ({ago(v.when)}) · trip {v.tripMin} min · {v.places} {v.places === 1 ? "place" : "places"} hit
                    </span>
                  </>
                ) : (
                  <span className="soft">Not yet. Add a {g.label.toLowerCase()} to a plan.</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <h2>Appearance</h2>
      <p className="soft">Light is the default. Auto follows your phone.</p>
      <ThemeToggle />

      <p className="soft">Saved on this phone{" "}(and in the app&apos;s database when one is set up). No account needed.</p>
    </main>
  );
}

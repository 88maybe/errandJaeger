"use client";

import { eventEnd, eventStart, orderedEvents } from "@/lib/planner/schedule";
import { formatNY } from "@/lib/planner/time";
import type { RoutePlan, TransitLeg } from "@/lib/planner/types";
import { delayText, type LiveInfo } from "@/lib/transit/live";
import type { LiveState } from "@/lib/useLive";
import TimeChip from "./TimeChip";

// One line about a train's live status: "Live 3:26 PM · 2 min late".
export function LiveLine({ info }: { info: LiveInfo }) {
  const delay = delayText(info);
  return (
    <p className="live-line">
      <TimeChip basis="live" />
      {info.predictedDep ? <strong>{formatNY(info.predictedDep)}</strong> : <strong>{info.headline}</strong>}
      {delay && <span> · {delay}</span>}
    </p>
  );
}

// The "right now" card: when to leave, what you're doing, and the next train (live if we have it, else scheduled).
export function NowCard({ plan, live }: { plan: RoutePlan; live: LiveState }) {
  const { now, infos, status, ready } = live;
  if (!ready) return null;
  const leaveIn = Math.ceil((new Date(plan.leaveBy).getTime() - now.getTime()) / 60000);

  const events = orderedEvents(plan);
  const current = events.find((e) => eventEnd(e) > now.getTime() && eventStart(e) <= now.getTime());
  const nextTrain = plan.legs.find(
    (l): l is TransitLeg => l.type === "transit" && new Date(l.departAt ?? new Date(l.startTime).getTime() + l.waitMin * 60000).getTime() >= now.getTime() - 60_000,
  );
  const info = nextTrain ? infos[nextTrain.startTime] : undefined;
  const scheduledDep = nextTrain ? new Date(nextTrain.departAt ?? new Date(nextTrain.startTime).getTime() + nextTrain.waitMin * 60000) : null;
  const schedMin = scheduledDep ? Math.max(0, Math.ceil((scheduledDep.getTime() - now.getTime()) / 60000)) : null;

  return (
    <section className="card now-card" aria-live="polite">
      <p className="label">Right now</p>
      {leaveIn > 0 ? (
        <p className="now-big">Leave in {leaveIn} min</p>
      ) : current ? (
        <p className="now-big">
          {"leg" in current
            ? current.leg.type === "walk"
              ? `Walking to ${current.leg.to}`
              : new Date(current.leg.departAt ?? new Date(current.leg.startTime).getTime() + current.leg.waitMin * 60000).getTime() > now.getTime()
                ? `Waiting for the train at ${current.leg.boardAt}`
                : `On the ${current.leg.lineLabel}`
            : `At ${current.stop.place.name}`}
        </p>
      ) : (
        <p className="now-big">You&apos;re between steps</p>
      )}

      {nextTrain && (
        <div className="now-train">
          <p>
            <strong>{info ? info.headline : `Train in ${schedMin} min`}</strong> from {nextTrain.boardAt} toward {nextTrain.toward.join(" or ")}
          </p>
          {info ? (
            <LiveLine info={info} />
          ) : (
            scheduledDep && (
              <p className="live-line">
                <TimeChip basis={nextTrain.departBasis ?? "estimate"} />
                <strong>{formatNY(scheduledDep)}</strong>
              </p>
            )
          )}
          {info && nextTrain.departAt && (
            <p className="soft">
              Scheduled {formatNY(nextTrain.departAt)} <TimeChip basis="scheduled" />
            </p>
          )}
        </div>
      )}
      {info?.plannedTrainLeft && (
        <p className="step-warning" role="alert">
          The train we planned has already left. Tap &quot;I&apos;m running late&quot; then &quot;I missed it&quot; to pick the next one.
        </p>
      )}
      {nextTrain && status === "unavailable" && <p className="soft">Live times aren&apos;t available right now, so these are scheduled times.</p>}
    </section>
  );
}

// "I'm running late": +5, +10, +15 or "I missed it". Recomputes from the new time.
export function LatePanel({ onLate, busy }: { onLate: (kind: 5 | 10 | 15 | "missed") => void; busy: boolean }) {
  return (
    <details className="late card">
      <summary>I&apos;m running late</summary>
      <p className="soft">We&apos;ll pick the next train you can still catch and move everything after it.</p>
      <div className="late-buttons">
        {([5, 10, 15] as const).map((n) => (
          <button key={n} type="button" className="btn btn-secondary" disabled={busy} onClick={() => onLate(n)}>
            +{n} min
          </button>
        ))}
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => onLate("missed")}>
          I missed it
        </button>
      </div>
    </details>
  );
}

// What changed after a re-time, in plain words, with a way to drop a stop that would now be closed.
export function ChangeCard({
  lines,
  drops,
  onDrop,
  onDismiss,
  busy,
}: {
  lines: string[];
  drops: { id: string; name: string }[];
  onDrop: (id: string) => void;
  onDismiss: () => void;
  busy: boolean;
}) {
  return (
    <section className="card change-card" role="status">
      <strong>What changed</strong>
      <ul>
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <div className="change-buttons">
        {drops.map((d) => (
          <button key={d.id} type="button" className="btn btn-primary" disabled={busy} onClick={() => onDrop(d.id)}>
            Drop {d.name}
          </button>
        ))}
        <button type="button" className="btn btn-secondary" onClick={onDismiss}>
          Got it
        </button>
      </div>
    </section>
  );
}

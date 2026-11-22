"use client";

import { Banner, Skeleton, Spinner, Working } from "@/components/Busy";
import { formatNY } from "@/lib/planner/time";
import { DepChips, leaveInText, RouteStrip } from "./Bits";
import type { ViewOption } from "./types";

export type Tab = "transit" | "walk" | "car";

type Props = {
  tab: Tab;
  onTab: (t: Tab) => void;
  transit: ViewOption[];
  walk: ViewOption | null;
  car: ViewOption | null;
  carState: "loading" | "ok" | "failed";
  liveState: "loading" | "live" | "unavailable";
  now: Date;
  onChoose: (o: ViewOption) => void;
  computing: boolean; // still working out the transit options
  walkNote: string | null; // OSRM couldn't answer: say walking times are estimates from distance
};

const mins = (n: number) => `${n} min`;

// The options screen: a tab row (Transit / Walk / Car), each with its time, then the choices.
export default function OptionsView({ tab, onTab, transit, walk, car, carState, liveState, now, onChoose, computing, walkNote }: Props) {
  const tabs: { id: Tab; label: string; time: string }[] = [
    { id: "transit", label: "Transit", time: transit[0] ? (transit[0].walksReady ? mins(transit[0].summary.totalMin) : "…") : "–" },
    { id: "walk", label: "Walk", time: walk ? mins(walk.summary.totalMin) : "–" },
    { id: "car", label: "Car", time: car ? mins(car.summary.totalMin) : carState === "loading" ? "…" : "–" },
  ];

  return (
    <div className="options">
      <div className="mode-tabs" role="tablist" aria-label="How to get there">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className="mode-tab" onClick={() => onTab(t.id)}>
            <span>{t.label}</span>
            <strong>{t.time}</strong>
          </button>
        ))}
      </div>

      {tab === "transit" && (
        <div role="tabpanel" aria-label="Transit">
          {walkNote && <Banner>{walkNote}</Banner>}
          {computing && <Skeleton rows={2} label="Finding train routes" />}
          {!computing && transit.length === 0 && (
            <div className="empty-state">
              <p>No train route makes sense for this trip.</p>
              <button type="button" className="btn btn-secondary btn-small" onClick={() => onTab("walk")}>
                See the walk
              </button>
            </div>
          )}
          {transit.map((o) => (
            <button key={o.key} type="button" className="option-card" onClick={() => onChoose(o)}>
              <span className="option-tags">
                {o.tags.map((t) => (
                  <span key={t} className="option-tag">
                    {t}
                  </span>
                ))}
              </span>
              <RouteStrip option={o} />
              {!o.walksReady ? (
                <span className="soft">
                  <Spinner /> Working out the walking times…
                </span>
              ) : (
              <>
              <span className="option-times">
                Leave {formatNY(o.summary.leaveAt)}, arrive {formatNY(o.summary.arriveAt)}, <strong>{o.summary.totalMin} min</strong>
                <small> ({o.checked === "scheduled" ? "trains scheduled, walks estimated" : "estimate"})</small>
              </span>
              <span className="option-leave">{leaveInText(o.summary.leaveAt, now)}</span>
              </>
              )}
              <DepChips deps={o.deps} />
              {o.checked === "pending" && (
                <small className="soft">
                  <Spinner /> Checking train times…
                </small>
              )}
              {o.checked === "failed" && <small className="soft">Couldn&apos;t check train times. Please verify before you go.</small>}
              {o.plan.trainWarnings?.map((w) => (
                <small key={w} className="option-warning">
                  {w}
                </small>
              ))}
            </button>
          ))}
          {transit.length > 0 && liveState === "loading" && <Working busy text="Checking live train times…" />}
          {transit.length > 0 && liveState === "unavailable" && <Banner>No live train data right now, so these are scheduled times.</Banner>}
          <p className="soft bus-note">Buses: coming later. For now only the subway is included.</p>
        </div>
      )}

      {tab === "walk" && (
        <div role="tabpanel" aria-label="Walk">
          {walk ? (
            <button type="button" className="option-card" onClick={() => onChoose(walk)}>
              <span className="option-times">
                <strong>{walk.summary.totalMin} min walk</strong> (estimate)
                {walk.distanceM ? `, ${(walk.distanceM / 1000).toFixed(1)} km` : ""}
              </span>
              <span className="option-times">
                Leave now, arrive about {formatNY(walk.summary.arriveAt)}
              </span>
            </button>
          ) : (
            <Working busy text="Working out the walk…" />
          )}
        </div>
      )}

      {tab === "car" && (
        <div role="tabpanel" aria-label="Car">
          {car ? (
            <button type="button" className="option-card" onClick={() => onChoose(car)}>
              <span className="option-times">
                <strong>{car.summary.totalMin} min drive</strong> (estimate, without traffic or parking)
                {car.distanceM ? `, ${(car.distanceM / 1000).toFixed(1)} km` : ""}
              </span>
              <span className="option-times">Leave now, arrive about {formatNY(car.summary.arriveAt)}</span>
            </button>
          ) : (
            carState === "loading" ? (
              <Working busy text="Working out the drive…" />
            ) : (
              <Banner tone="warn">Couldn&apos;t get a driving time right now. Try again in a minute, or use Transit or Walk.</Banner>
            )
          )}
        </div>
      )}
    </div>
  );
}

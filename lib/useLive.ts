"use client";

// While an outing is active, refresh live train info every 30 seconds (and the "in N min" clock with it).
import { useEffect, useRef, useState } from "react";
import type { RoutePlan, TransitLeg } from "./planner/types";
import type { Departures } from "./planner/schedule";
import { legKey, transitLegs } from "./transit/client";
import { fetchLive, liveInfoFor, liveKey, type LiveInfo, type LiveResponse } from "./transit/live";

export const LIVE_REFRESH_MS = 30_000;

export type LiveState = {
  now: Date;
  ready: boolean; // false until the first clock reading (keeps the first render the same on server and browser)
  infos: Record<string, LiveInfo>; // by the leg's startTime
  status: "loading" | "live" | "unavailable"; // unavailable = we show scheduled times instead
};

export function useLive(plan: RoutePlan | null, active: boolean, train?: Departures): LiveState {
  const [nowMs, setNowMs] = useState(0); // 0 = not read yet
  const now = new Date(nowMs);
  const [data, setData] = useState<LiveResponse | null>(null);
  const [status, setStatus] = useState<LiveState["status"]>("loading");
  const planRef = useRef(plan);
  planRef.current = plan;
  const hasTrains = !!plan && transitLegs(plan).length > 0;

  useEffect(() => {
    if (!active) return;
    let alive = true;
    async function tick() {
      setNowMs(Date.now());
      const p = planRef.current;
      if (!p || transitLegs(p).length === 0 || document.hidden) return;
      const result = await fetchLive(p);
      if (!alive) return;
      setData(result);
      setStatus(result && Object.keys(result.predictions).length > 0 ? "live" : "unavailable");
    }
    void tick();
    const timer = setInterval(tick, LIVE_REFRESH_MS);
    const onVisible = () => !document.hidden && void tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active, hasTrains, plan?.leaveBy]);

  const infos: Record<string, LiveInfo> = {};
  if (plan && data && nowMs > 0) {
    for (const leg of transitLegs(plan) as TransitLeg[]) {
      // Only trains that haven't left yet, and are due within the next hour or so.
      const dep = leg.departAt ? new Date(leg.departAt).getTime() : new Date(leg.startTime).getTime();
      if (dep < now.getTime() - 60_000 || dep > now.getTime() + 90 * 60_000) continue;
      const trips = train?.[legKey(leg)];
      const info = liveInfoFor(leg, data.predictions[liveKey(leg)], now, trips ? new Set(trips.map((t) => t.trip)) : null);
      if (info) infos[leg.startTime] = info;
    }
  }
  return { now, ready: nowMs > 0, infos, status };
}

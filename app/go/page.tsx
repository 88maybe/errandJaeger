"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import MapView, { type MapPoint, type RouteLine } from "@/components/MapView";
import OptionsView, { type Tab } from "@/components/go/OptionsView";
import RouteView from "@/components/go/RouteView";
import type { Dep, ViewOption } from "@/components/go/types";
import { findTransitOptions, miniPlan, nextTrips, summarize } from "@/lib/directions/options";
import { fetchOsrm } from "@/lib/directions/osrm";
import { segmentsOf, type Segment } from "@/lib/directions/segments";
import { isLocationOn, setLocationOn } from "@/lib/location";
import { DOWNTOWN, inArea } from "@/lib/nearby/categories";
import type { OsrmRoute } from "@/lib/osrm/types";
import { compassDirection, walkMinutes } from "@/lib/planner/geo";
import { applyTrainData } from "@/lib/planner/schedule";
import type { Point, RoutePlan } from "@/lib/planner/types";
import { fetchTrainData, legKey, transitLegs, type CheckResponse } from "@/lib/transit/client";
import { LINE_COLOUR, familyOf } from "@/lib/transit/look";
import { fetchLive, liveKey, type LiveResponse } from "@/lib/transit/live";
import { useOuting } from "@/lib/useOuting";

// Directions to one stop of your plan: options (Transit / Walk / Car), then the route on a map with simple steps.
// Facts come from our map, the MBTA schedule and live data, and OSRM; nothing here is written by AI.

const LIVE_MS = 30_000;
const CLOCK_MS = 15_000;
type LatLng = { lat: number; lng: number };
const WALK_COLOUR = "#2a2622";
const CAR_COLOUR = "#5c534a";

const minuteFloor = (ms: number) => new Date(Math.floor(ms / 60000) * 60000);

export default function GoPage() {
  const { outing, loaded } = useOuting();
  const [index, setIndex] = useState<number | null>(null); // which stop we are going to
  const [nowMs, setNowMs] = useState(0);
  const [user, setUser] = useState<LatLng | null>(null);
  const watchId = useRef<number | null>(null);
  const [tab, setTab] = useState<Tab>("transit");
  const [chosenKey, setChosenKey] = useState<string | null>(null);
  // Schedule lookup per transit option: "pending" while asking, null if it failed.
  const [checks, setChecks] = useState<Record<string, CheckResponse | null | "pending">>({});
  const asked = useRef(new Set<string>());
  const [live, setLive] = useState<LiveResponse | null>(null);
  const [liveState, setLiveState] = useState<"loading" | "live" | "unavailable">("loading");
  const [walkRoute, setWalkRoute] = useState<OsrmRoute | null | undefined>(undefined);
  const [carRoute, setCarRoute] = useState<OsrmRoute | null | undefined>(undefined);
  const [segWalks, setSegWalks] = useState<Record<string, OsrmRoute | null>>({});
  const [reducedMotion, setReducedMotion] = useState(false);

  // Clock, motion setting, and (if you turned it on earlier in this tab) your location.
  useEffect(() => {
    setNowMs(Date.now());
    const t = setInterval(() => setNowMs(Date.now()), CLOCK_MS);
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (isLocationOn() && "geolocation" in navigator) {
      watchId.current = navigator.geolocation.watchPosition(
        (pos) => {
          const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          if (inArea(here)) setUser(here);
        },
        () => setLocationOn(false),
        { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
      );
    }
    return () => {
      clearInterval(t);
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, []);

  // Start with the first stop you haven't ticked on the bingo card.
  useEffect(() => {
    if (!outing || index !== null) return;
    const tickedIds = new Set(outing.ticked.map((i) => outing.card[i]?.id));
    const next = outing.plan.stops.findIndex((s) => !tickedIds.has(`stop-${s.place.id}`));
    setIndex(next >= 0 ? next : 0);
  }, [outing, index]);

  const stops = outing?.plan.stops ?? [];
  const stop = index !== null ? stops[index] : undefined;
  const dest: Point | null = stop ? { name: stop.place.name, lat: stop.place.lat, lng: stop.place.lng } : null;
  // From: your live location, or the previous stop, or where the plan starts.
  const userKey = user ? `${user.lat.toFixed(3)},${user.lng.toFixed(3)}` : ""; // only re-plan after ~100 m of movement
  const origin: (Point & { private?: boolean }) | null = useMemo(() => {
    if (!outing || index === null) return null;
    if (user) return { name: "Your location", lat: user.lat, lng: user.lng, private: true };
    if (index === 0) return outing.plan.start;
    const p = outing.plan.stops[index - 1].place;
    return { name: p.name, lat: p.lat, lng: p.lng };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outing, index, userKey]);
  const tripKey = origin && dest ? `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}>${dest.lat},${dest.lng}` : "";
  const minuteKey = Math.floor(nowMs / 60000);

  // Transit options, worked out from this minute (pure code, cheap).
  const base = useMemo(() => {
    if (!origin || !dest || nowMs === 0) return [];
    return findTransitOptions(origin, dest, minuteFloor(nowMs));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripKey, minuteKey]);

  // Real schedules: one lookup per option (it returns the whole day's trips, so re-timing later needs no new call).
  useEffect(() => {
    for (const o of base) {
      if (asked.current.has(o.key)) continue;
      asked.current.add(o.key);
      setChecks((c) => ({ ...c, [o.key]: "pending" }));
      fetchTrainData(o.plan).then((data) => setChecks((c) => ({ ...c, [o.key]: data ?? null })));
    }
  }, [base]);

  // Live predictions for the first train of each option, every 30 seconds.
  const firstRides = useMemo(() => base.flatMap((o) => transitLegs(o.plan).slice(0, 1)), [base]);
  const liveRef = useRef(firstRides);
  liveRef.current = firstRides;
  useEffect(() => {
    if (!tripKey) return;
    let alive = true;
    const tick = async () => {
      const rides = liveRef.current;
      if (rides.length === 0 || document.hidden) return;
      const fake: RoutePlan = { ...miniPlan(origin as Point, dest as Point, rides, new Date(), 0) };
      const res = await fetchLive(fake);
      if (!alive) return;
      setLive(res);
      setLiveState(res && Object.keys(res.predictions).length > 0 ? "live" : "unavailable");
    };
    void tick();
    const t = setInterval(tick, LIVE_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripKey, firstRides.length]);

  // Walking and driving (OSRM). Falls back to our own distance estimate for walking.
  useEffect(() => {
    if (!origin || !dest) return;
    setWalkRoute(undefined);
    setCarRoute(undefined);
    fetchOsrm("foot", origin, dest).then(setWalkRoute);
    fetchOsrm("car", origin, dest).then(setCarRoute);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripKey]);

  const now = new Date(nowMs);

  // Transit options with schedules and live times applied.
  const transit: ViewOption[] = useMemo(() => {
    return base.map((o) => {
      const entry = checks[o.key];
      const pending = entry === undefined || entry === "pending";
      const data = pending ? null : entry;
      const plan = applyTrainData(o.plan, data);
      const first = transitLegs(plan)[0];
      const scheduled = first ? nextTrips(first, data?.departures?.[legKey(first)]) : [];
      const preds = first ? live?.predictions[liveKey(first)] : undefined;
      let deps: Dep[] = scheduled.map((t) => {
        const p = preds?.find((x) => x.trip === t.trip && x.dep);
        return p?.dep ? { time: p.dep, basis: "live", note: null } : { time: t.dep, basis: "scheduled", note: null };
      });
      if (deps.length === 0 && preds && first) {
        // No timetable, but live times for this platform, route and direction.
        const reach = new Date(first.startTime).getTime();
        deps = preds
          .filter((p) => p.dep && new Date(p.dep).getTime() >= reach)
          .slice(0, 2)
          .map((p) => ({ time: p.dep as string, basis: "live", note: p.status }));
      }
      return {
        key: o.key,
        mode: "transit" as const,
        tags: o.tags,
        plan,
        summary: summarize(plan),
        deps,
        alerts: plan.alerts ?? [],
        checked: pending ? "pending" : data ? (plan.trainCheck === "ok" ? "scheduled" : "failed") : "failed",
      };
    });
  }, [base, checks, live]);

  // Walk and car as simple one-leg options.
  const walk: ViewOption | null = useMemo(() => {
    if (!origin || !dest || nowMs === 0 || walkRoute === undefined) return null;
    const minutes = walkRoute?.durationMin ?? walkMinutes(origin, dest);
    const clock = minuteFloor(nowMs);
    const plan = miniPlan(origin, dest, [
      { type: "walk", from: origin.name, to: dest.name, startTime: clock.toISOString(), durationMin: minutes, instruction: `Head ${compassDirection(origin, dest)}. About ${minutes} min walk (estimate).` },
    ], clock, minutes);
    return { key: "walk", mode: "walk", tags: [], plan, summary: summarize(plan), deps: [], alerts: [], checked: "none", distanceM: walkRoute?.distanceM };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripKey, walkRoute, minuteKey]);

  const car: ViewOption | null = useMemo(() => {
    if (!origin || !dest || nowMs === 0 || !carRoute) return null;
    const clock = minuteFloor(nowMs);
    const plan = miniPlan(origin, dest, [], clock, carRoute.durationMin);
    const summary = { ...summarize(plan), walkMin: 0, rideMin: carRoute.durationMin, waitMin: 0 };
    return { key: "car", mode: "car", tags: [], plan, summary, deps: [], alerts: [], checked: "none", carMin: carRoute.durationMin, distanceM: carRoute.distanceM };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripKey, carRoute, minuteKey]);

  // The option you picked (it keeps up with the clock and live data).
  const lastChosen = useRef<ViewOption | null>(null);
  const chosen = chosenKey === "walk" ? walk : chosenKey === "car" ? car : (transit.find((o) => o.key === chosenKey) ?? null);
  if (chosen) lastChosen.current = chosen;
  const shown = chosenKey ? (chosen ?? lastChosen.current) : null;

  const segments: Segment[] = useMemo(
    () => (shown && origin && dest && shown.mode !== "car" ? segmentsOf(shown.plan, origin, dest) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shown?.key, shown?.plan.legs.length, tripKey],
  );
  const segKey = (s: Segment) => (s.kind === "walk" ? `${s.from.lat.toFixed(4)},${s.from.lng.toFixed(4)}>${s.to.lat.toFixed(4)},${s.to.lng.toFixed(4)}` : "");

  // Walking directions for each walk of the chosen route.
  useEffect(() => {
    segments.forEach((s, i) => {
      if (s.kind !== "walk") return;
      const k = segKey(s);
      if (k in segWalks) return;
      const fromPrivate = i === 0 && !!user; // your live location: rounded before it leaves the phone
      fetchOsrm("foot", { ...s.from, private: fromPrivate }, s.to).then((r) => setSegWalks((w) => ({ ...w, [k]: r })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments]);

  // Map drawing for the chosen route.
  const map = useMemo(() => {
    if (!shown || !origin || !dest) return null;
    const lines: RouteLine[] = [];
    const points: MapPoint[] = [
      { lat: origin.lat, lng: origin.lng, kind: "start", label: `Start: ${origin.name}` },
      { lat: dest.lat, lng: dest.lng, kind: "end", label: `Destination: ${dest.name}` },
    ];
    if (shown.mode === "car") {
      lines.push({ coords: carRoute?.geometry ?? [[origin.lng, origin.lat], [dest.lng, dest.lat]], colour: CAR_COLOUR, dotted: false });
    }
    for (const s of segments) {
      if (s.kind === "walk") {
        const r = segWalks[segKey(s)];
        // Join the exact ends, so the dotted line meets the stations and your real spot.
        const middle = r?.geometry ?? [];
        lines.push({ coords: [[s.from.lng, s.from.lat], ...middle, [s.to.lng, s.to.lat]], colour: WALK_COLOUR, dotted: true });
      } else {
        const colour = LINE_COLOUR[familyOf(s.leg.routeIds)];
        lines.push({ coords: s.stations.map((st) => [st.lng, st.lat]), colour, dotted: false });
        for (const st of [s.stations[0], s.stations[s.stations.length - 1]]) {
          if (st) points.push({ lat: st.lat, lng: st.lng, kind: "station", label: `${st.name} station`, colour });
        }
      }
    }
    const fit = lines.flatMap((l) => l.coords);
    return { lines, points, fit };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown?.key, segments, segWalks, carRoute, tripKey]);

  // ---- Screens ----
  if (!loaded || (index === null && outing)) return <p className="soft">Loading…</p>;
  if (!outing || !stop || !origin || !dest) {
    return (
      <main>
        <h1 className="page-title">Directions</h1>
        <div className="card empty">
          <p>Directions appear once you have a plan with at least one stop.</p>
          <Link href="/" className="btn btn-primary">
            Make a plan
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="go">
      <header className="go-head">
        <h1 className="page-title">To {stop.place.name}</h1>
        <p className="soft">
          From {origin.name}
          {user ? " (live)" : ""}. Stop {index! + 1} of {stops.length}.
        </p>
        {stops.length > 1 && (
          <div className="go-stops">
            <button type="button" className="btn btn-secondary btn-small" disabled={index === 0} onClick={() => { setIndex(index! - 1); setChosenKey(null); }}>
              ‹ Previous stop
            </button>
            <button type="button" className="btn btn-secondary btn-small" disabled={index === stops.length - 1} onClick={() => { setIndex(index! + 1); setChosenKey(null); }}>
              Next stop ›
            </button>
          </div>
        )}
      </header>

      {shown && map ? (
        <>
          <div className="map-wrap go-map">
            <MapView
              center={DOWNTOWN}
              user={user}
              results={[]}
              radiusM={0}
              stim={false}
              reducedMotion={reducedMotion}
              searchKey={0}
              hitIds={[]}
              favIds={[]}
              onPick={() => {}}
              routeLines={map.lines}
              points={map.points}
              fitTo={map.fit}
            />
          </div>
          <RouteView
            option={shown}
            segments={segments}
            walks={Object.fromEntries(segments.map((s, i) => [i, s.kind === "walk" ? segWalks[segKey(s)] : undefined]))}
            destName={stop.place.name}
            now={now}
            onBack={() => setChosenKey(null)}
          />
        </>
      ) : (
        <OptionsView
          tab={tab}
          onTab={setTab}
          transit={transit}
          walk={walk}
          car={car}
          carState={carRoute === undefined ? "loading" : carRoute ? "ok" : "failed"}
          liveState={liveState}
          now={now}
          onChoose={(o) => setChosenKey(o.key)}
        />
      )}
      <p className="soft go-foot">
        Walking and driving routes: OpenStreetMap (OSRM). Train times: MBTA. Times without a Live or Scheduled label are estimates.
      </p>
    </main>
  );
}

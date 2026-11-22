"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BrainDump from "@/components/BrainDump";
import Hitlist from "@/components/Hitlist";
import MapView from "@/components/MapView";
import NearbySheet from "@/components/NearbySheet";
import PlanForm, { type FormValues } from "@/components/PlanForm";
import { buildCard } from "@/lib/bingo";
import { DEFAULT_RADIUS, DOWNTOWN, GROUPS, inArea, kindById, KINDS, RADII, type KindId } from "@/lib/nearby/categories";
import { fetchNearby, isMission, measure, openStatus, toPlace, type Found } from "@/lib/nearby/client";
import type { NearbyPlace } from "@/lib/nearby/types";
import { isLocationOn, setLocationOn } from "@/lib/location";
import { applyStim } from "@/lib/stim";
import { planHitlist, planRoute } from "@/lib/planner";
import { PLACES } from "@/lib/planner/places";
import { todayAtNY } from "@/lib/planner/time";
import { applyTrainData } from "@/lib/planner/schedule";
import { emptyPlanMessage } from "@/lib/planner/timeline";
import type { Point, RoutePlan } from "@/lib/planner/types";
import { fetchTrainData } from "@/lib/transit/client";
import type { Departures } from "@/lib/planner/schedule";
import {
  getFavorites,
  getHistory,
  getHitlist,
  getOuting,
  getPrefs,
  saveFavorites,
  saveHitlist,
  saveOuting,
  savePrefs,
  type HitItem,
  type Outing,
  type Prefs,
} from "@/lib/storage";

// "Leave now": this moment, rounded down to the minute.
const startOfThisMinute = () => new Date(Math.floor(Date.now() / 60000) * 60000);

const MAX_HITLIST = 8; // the bingo card has 8 squares
const MARKERS_CALM = 8; // Stim mode off: fewer markers
const MARKERS_LIVELY = 25;

type LatLng = { lat: number; lng: number };

// Respect the phone's "reduce motion" setting.
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

// When the server can't be reached at all: our own list, measured here.
function localFallback(kind: KindId): NearbyPlace[] {
  const ids = kindById(kind)?.fallbackIds ?? [];
  return PLACES.filter((p) => ids.includes(p.id)).map((p) => ({ id: p.id, name: p.name, kind, lat: p.lat, lng: p.lng, hours: p.hours, hoursVerified: p.hoursVerified, source: "list" }));
}

export default function Home() {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [current, setCurrent] = useState<Outing | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [checking, setChecking] = useState(false); // looking up real train times
  // A finished new plan waiting for you to say "replace my current one".
  const [waiting, setWaiting] = useState<{ plan: RoutePlan; mode: "normal" | "calm"; train?: Departures; leftNow?: boolean; directions?: boolean; bingo?: boolean } | null>(null);

  // Where you start: a picked start point, or your live location (never asked for until you press the button).
  const [start, setStart] = useState<Point>(DOWNTOWN);
  const [user, setUser] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [locNote, setLocNote] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);
  const [mapCenter, setMapCenter] = useState<LatLng>(DOWNTOWN);

  // Map search
  const [stim, setStim] = useState(false);
  const [radius, setRadius] = useState(DEFAULT_RADIUS);
  const [includeAddOns, setIncludeAddOns] = useState(true);
  const [kind, setKind] = useState<KindId | null>(null);
  const [found, setFound] = useState<Found[]>([]);
  const [loading, setLoading] = useState(false);
  const [sheetNote, setSheetNote] = useState<string | null>(null);
  const [searchKey, setSearchKey] = useState(0);
  const [now, setNow] = useState<Date | null>(null);

  // Hitlist and favorites (saved in this browser)
  const [hitlist, setHitlist] = useState<HitItem[]>([]);
  const [favorites, setFavorites] = useState<NearbyPlace[]>([]);
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [trayNote, setTrayNote] = useState<string | null>(null);

  // Load what we remembered: your last choices, any plan in progress, hitlist and favorites.
  useEffect(() => {
    getPrefs().then((p) => {
      setPrefs(p);
      setStart(p.start);
      setMapCenter(p.start);
      setStim(!!p.stim);
      setRadius(RADII.includes(p.radius ?? 0) ? (p.radius as number) : DEFAULT_RADIUS);
      setIncludeAddOns(p.includeAddOns !== false);
    });
    getOuting().then(setCurrent);
    getHitlist().then(setHitlist);
    getFavorites().then(setFavorites);
    getHistory().then((h) => setVisited(new Set(h.flatMap((o) => o.plan.stops.map((s) => s.place.id)))));
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    // You turned on your location earlier in this tab: keep following it (no new question is asked).
    if (isLocationOn()) locate();
    return () => {
      clearInterval(t);
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, []);

  const usingLocation = !!user;
  const searchFrom: LatLng = user ?? start;
  const favIds = useMemo(() => favorites.map((f) => f.id), [favorites]);
  const hitIds = useMemo(() => hitlist.map((h) => h.id), [hitlist]);

  // Remember settings as they change (merged into what's saved).
  const rememberSettings = useCallback(
    (patch: Partial<Prefs>) => {
      if (!prefs) return;
      const next = { ...prefs, ...patch };
      setPrefs(next);
      savePrefs(next);
    },
    [prefs],
  );

  // ---- Location ----
  function stopLocation(note: string | null = null) {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    setLocationOn(false);
    setUser(null);
    setLocating(false);
    setLocNote(note);
  }

  function locate() {
    if (!("geolocation" in navigator)) {
      setLocNote("This browser can't share your location. Pick a start point below instead.");
      return;
    }
    setLocating(true);
    setLocNote(null);
    let first = true;
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (!inArea(here)) {
          stopLocation("errandJaeger only works around Greater Boston for now, so here is downtown Boston. Pick a start point below.");
          setMapCenter(DOWNTOWN);
          return;
        }
        setLocating(false);
        setLocationOn(true);
        setUser(here);
        if (first) {
          first = false;
          setMapCenter(here);
        }
      },
      () => stopLocation("Couldn't get your location. Pick a start point below instead."),
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
    );
  }

  function pickStart(point: Point) {
    if (usingLocation) stopLocation();
    setStart(point);
    setMapCenter(point);
  }

  // ---- Search ----
  async function search(k: KindId, r: number = radius) {
    setKind(k);
    setLoading(true);
    setSheetNote(null);
    setFound([]);
    const from = searchFrom;
    setMapCenter({ lat: from.lat, lng: from.lng });
    const res = await fetchNearby(k, from, r);
    let places = res?.places ?? localFallback(k);
    if (!res || res.source === "list") {
      setSheetNote("Couldn't reach OpenStreetMap, so these come from our own small list.");
    }
    if (res && res.ok === false && res.reason === "rate-limited") setSheetNote("Too many searches at once. Please wait a moment.");
    if (!res) places = localFallback(k);

    let list = measure(places, from, r);
    if (!stim) {
      // Calmer: favorites first, then places you've been before, then the nearest.
      const rank = (p: Found) => (favIds.includes(p.id) ? 0 : visited.has(p.id) ? 1 : 2);
      list = [...list].sort((a, b) => rank(a) - rank(b) || a.distanceM - b.distanceM);
    }
    setFound(list.slice(0, stim ? MARKERS_LIVELY : MARKERS_CALM));
    setLoading(false);
    setSearchKey((n) => n + 1);
  }

  function chooseRadius(r: number) {
    setRadius(r);
    rememberSettings({ radius: r });
    if (kind) search(kind, r);
  }

  function closeSheet() {
    setKind(null);
    setFound([]);
  }

  // A side quest (Stim mode): somewhere nearby you haven't been, starred, or picked.
  const sideQuest = useMemo(() => {
    const fresh = found.filter((p) => !favIds.includes(p.id) && !visited.has(p.id) && !hitIds.includes(p.id));
    if (fresh.length < 2) return null;
    return { place: fresh[1 + (searchKey % (fresh.length - 1))] }; // not just the nearest one
    // hitIds left out on purpose: the suggestion shouldn't jump when you add it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [found, favIds, visited, searchKey]);

  // ---- Hitlist ----
  function updateHitlist(next: HitItem[]) {
    setHitlist(next);
    saveHitlist(next);
  }

  function toggleHit(p: NearbyPlace) {
    setTrayNote(null);
    if (hitIds.includes(p.id)) {
      updateHitlist(hitlist.filter((h) => h.id !== p.id));
      return;
    }
    if (hitlist.length >= MAX_HITLIST) {
      setTrayNote(`Your hitlist is full (${MAX_HITLIST} places). Remove one to add another.`);
      return;
    }
    const { id, name, kind: k, lat, lng, hours, hoursVerified, source } = p;
    updateHitlist([...hitlist, { id, name, kind: k, lat, lng, hours, hoursVerified, source }]);
    setJustAdded(p.id);
    setTimeout(() => setJustAdded((cur) => (cur === p.id ? null : cur)), 900);
  }

  // Brain dump "Add nearest": the closest place of that kind that isn't closed (your favorites first).
  async function addNearest(k: KindId): Promise<string> {
    const res = await fetchNearby(k, searchFrom, radius);
    const list = measure(res?.places ?? localFallback(k), searchFrom, radius).filter((p) => !hitIds.includes(p.id));
    const now = new Date();
    const usable = list.filter((p) => openStatus(p, now).tone !== "closed");
    const pick = usable.find((p) => favIds.includes(p.id)) ?? usable[0];
    if (!pick) return list.length ? "Everything nearby looks closed now. Tap Choose to look anyway." : "Nothing found nearby. Try a bigger distance.";
    if (hitlist.length >= MAX_HITLIST) return `Your hitlist is full (${MAX_HITLIST} places).`;
    toggleHit(pick);
    return `Added ${pick.name}, about ${pick.walkMin} min walk (estimate).`;
  }

  function pickFromMap(id: string) {
    const p = found.find((f) => f.id === id);
    if (p) toggleHit(p);
  }

  function moveHit(index: number, by: -1 | 1) {
    const next = [...hitlist];
    const j = index + by;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    updateHitlist(next);
  }

  function toggleFavorite(p: NearbyPlace) {
    const next = favIds.includes(p.id)
      ? favorites.filter((f) => f.id !== p.id)
      : [...favorites, { id: p.id, name: p.name, kind: p.kind, lat: p.lat, lng: p.lng, hours: p.hours, hoursVerified: p.hoursVerified, source: p.source }];
    setFavorites(next);
    saveFavorites(next);
  }

  // ---- Planning ----
  // A plan made from the hitlist opens the directions (ways to get to the first stop); otherwise the plan.
  async function saveAndGo(plan: RoutePlan, mode: "normal" | "calm", train?: Departures, leftNow?: boolean, directions?: boolean, bingo = true) {
    const id = Date.now().toString(36);
    await saveOuting({ id, createdAt: new Date().toISOString(), mode, plan, card: buildCard(plan, id), ticked: [], step: 0, train, leftNow, bingo });
    updateHitlist([]); // the hitlist became this plan
    router.push(directions ? "/go" : "/plan");
  }

  async function makePlan(values: FormValues) {
    // Remember the choices, so coming back keeps them. (Your live location is never saved.)
    const nextPrefs: Prefs = { ...(prefs as Prefs), needs: values.needs, loop: values.loop, calm: values.calm, bingo: values.bingo, start, stim, radius, includeAddOns };
    setPrefs(nextPrefs);
    await savePrefs(nextPrefs);
    setWaiting(null);

    const mode = values.calm ? "calm" : "normal";
    const startTime = values.leaveNow ? startOfThisMinute() : todayAtNY(values.startHHMM);
    const from: Point = user ? { name: "Your location", lat: user.lat, lng: user.lng } : start;

    let estimated: RoutePlan;
    const fromHitlist = hitlist.length > 0;
    if (fromHitlist) {
      // Stim mode on: your order. Off: the errands first (direct), then the add-ons if you want them.
      const missions = hitlist.filter(isMission);
      const addOns = hitlist.filter((p) => !isMission(p));
      const ordered = stim ? hitlist : [...missions, ...(includeAddOns ? addOns : [])];
      if (ordered.length === 0) {
        setMessage("Your hitlist only has add-ons. Turn on \"Include the add-ons\", or add an errand.");
        return;
      }
      estimated = planHitlist({ startTime, loop: values.loop, mode, start: from }, ordered.map(toPlace));
    } else {
      // Pick by type. Your starred places count as "a favorite spot".
      const ours = PLACES.map((p) => (favIds.includes(p.id) && !p.tags.includes("favorite") ? { ...p, tags: [...p.tags, "favorite"] } : p));
      const extra = favorites.filter((f) => !PLACES.some((p) => p.id === f.id)).map((f) => ({ ...toPlace(f), tags: ["favorite"] }));
      estimated = planRoute({ needs: values.needs, startTime, loop: values.loop, mode, start: from }, [...ours, ...extra]);
    }

    // Nothing fits: show the kind message here, and keep any plan already in progress.
    const empty = emptyPlanMessage(estimated);
    if (empty) {
      setMessage(
        hitlist.length > 0 && estimated.skipped.length > 0
          ? `${estimated.skipped.map((s) => `${s.name}: ${s.reason}`).join(" ")} Try another time or other places.`
          : empty,
      );
      return;
    }
    setMessage(null);

    // Train rides: swap the estimated waits for the real scheduled times. If the lookup fails, the plan still works.
    let plan = estimated;
    let train: Departures | undefined;
    if (estimated.legs.some((l) => l.type === "transit")) {
      setChecking(true);
      const data = await fetchTrainData(estimated);
      plan = applyTrainData(estimated, data);
      train = data?.departures; // saved, so "I'm running late" can re-time without asking again
      setChecking(false);
    } else {
      plan = applyTrainData(estimated, null);
    }

    // A plan is already in progress: ask before replacing it.
    if (current) {
      setWaiting({ plan, mode, train, leftNow: !!values.leaveNow, directions: fromHitlist, bingo: values.bingo });
      return;
    }
    await saveAndGo(plan, mode, train, !!values.leaveNow, fromHitlist, values.bingo);
  }

  const kindLabel = kind ? kindById(kind)?.label : "";
  const distLabel = radius < 1000 ? `${radius} m` : `${radius / 1000} km`;
  const quickFavs = favorites.filter((f) => !hitIds.includes(f.id)).slice(0, 6);

  return (
    <main className={`home ${kind ? "has-sheet" : ""}`}>
      <header className="brand brand-compact">
        <h1>errandJaeger</h1>
        <p>Turn today&apos;s errands into a calmer bingo walk.</p>
      </header>

      {current && !waiting && (
        <Link href="/plan" className="card resume">
          <strong>You have a plan in progress</strong>
          <span>
            {current.plan.stops.length} {current.plan.stops.length === 1 ? "stop" : "stops"} from {current.plan.start.name}. Continue
          </span>
        </Link>
      )}

      {waiting && (
        <div className="card confirm" role="alertdialog" aria-labelledby="replace-title">
          <strong id="replace-title">Replace your plan in progress?</strong>
          <p>Your new plan is ready. Making it will replace the plan you already started, and its bingo ticks.</p>
          <div className="confirm-buttons">
            <button type="button" className="btn btn-secondary" onClick={() => router.push("/plan")}>
              Keep my current plan
            </button>
            <button type="button" className="btn btn-primary" onClick={() => saveAndGo(waiting.plan, waiting.mode, waiting.train, waiting.leftNow, waiting.directions, waiting.bingo)}>
              Replace it
            </button>
          </div>
        </div>
      )}

      <div className={`map-wrap ${stim ? "is-lively" : "is-calm"}`}>
        <div className="cat-chips" role="toolbar" aria-label="Search nearby">
          {GROUPS.map((g) => (
            <div key={g.id} className="cat-group" role="group" aria-label={g.label}>
              <span className="cat-group-label">{g.label}</span>
              {KINDS.filter((k) => k.group === g.id).map((k) => (
                <button
                  key={k.id}
                  type="button"
                  className={`cat-chip cat-${g.id}`}
                  aria-pressed={kind === k.id}
                  onClick={() => (kind === k.id ? closeSheet() : search(k.id))}
                >
                  {k.label}
                </button>
              ))}
            </div>
          ))}
        </div>

        <MapView
          center={mapCenter}
          user={user}
          results={found}
          radiusM={radius}
          stim={stim}
          reducedMotion={reducedMotion}
          searchKey={searchKey}
          hitIds={hitIds}
          favIds={favIds}
          onPick={pickFromMap}
        />

        <div className="map-tools">
          <div className="radius" role="group" aria-label="Search distance">
            {RADII.map((r) => (
              <button key={r} type="button" aria-pressed={radius === r} onClick={() => chooseRadius(r)}>
                {r < 1000 ? `${r} m` : `${r / 1000} km`}
              </button>
            ))}
          </div>
          <button type="button" className="locate-btn" onClick={() => (usingLocation || locating ? stopLocation() : locate())}>
            {locating ? "Finding you…" : usingLocation ? "Stop using my location" : "Use my location"}
          </button>
        </div>
      </div>
      {locNote && (
        <p className="soft loc-note" role="status">
          {locNote}
        </p>
      )}

      <BrainDump onAddNearest={addNearest} onShow={(k) => search(k)} />

      <label className="toggle stim-toggle">
        <input
          type="checkbox"
          checked={stim}
          onChange={(e) => {
            setStim(e.target.checked);
            applyStim(e.target.checked);
            rememberSettings({ stim: e.target.checked });
          }}
        />
        <span>
          Stim mode {stim ? "on" : "off"}
          <small>
            {stim
              ? "A livelier map, more places, side quests. Stops in the order you pick."
              : "Fewer places and gentle fades. Errands first; add-ons are optional. Favorites come first."}
          </small>
        </span>
      </label>

      {quickFavs.length > 0 && (
        <section className="favs" aria-label="Your favorites">
          <h2>{stim ? "Your favorites" : "Familiar favorites"}</h2>
          <div className="chips">
            {quickFavs.map((f) => (
              <button key={f.id} type="button" className="chip chip-small" onClick={() => toggleHit(f)}>
                ★ {f.name}
              </button>
            ))}
          </div>
        </section>
      )}

      <Hitlist
        items={hitlist}
        stim={stim}
        includeAddOns={includeAddOns}
        justAdded={justAdded}
        reducedMotion={reducedMotion}
        onMove={moveHit}
        onRemove={(id) => updateHitlist(hitlist.filter((h) => h.id !== id))}
        onIncludeAddOns={(v) => {
          setIncludeAddOns(v);
          rememberSettings({ includeAddOns: v });
        }}
      />
      {trayNote && (
        <p className="soft" role="status">
          {trayNote}
        </p>
      )}

      {prefs ? (
        <PlanForm initial={prefs} onSubmit={makePlan} start={start} onStart={pickStart} usingLocation={usingLocation} hitlistCount={hitlist.length} />
      ) : (
        <p className="soft">Loading…</p>
      )}

      {checking && (
        <p className="soft" role="status">
          Checking train times…
        </p>
      )}

      {message && (
        <p className="kind-message" role="status">
          {message}
        </p>
      )}

      {kind && now && (
        <NearbySheet
          title={`${kindLabel} within ${distLabel}`}
          loading={loading}
          note={sheetNote}
          results={found}
          hitIds={hitIds}
          favIds={favIds}
          stim={stim}
          reducedMotion={reducedMotion}
          searchKey={searchKey}
          sideQuest={sideQuest}
          now={now}
          onToggle={toggleHit}
          onStar={toggleFavorite}
          onClose={closeSheet}
        />
      )}
    </main>
  );
}

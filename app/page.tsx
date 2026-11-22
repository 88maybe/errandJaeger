"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BrainDump from "@/components/BrainDump";
import { Skeleton, Banner, Spinner } from "@/components/Busy";
import Dialog from "@/components/Dialog";
import { useToast } from "@/components/Toast";
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

// "Go now": this moment, rounded down to the minute.
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
  const toast = useToast();
  const reducedMotion = useReducedMotion();
  const [planBusy, setPlanBusy] = useState(false); // making a plan (and checking train times)
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [current, setCurrent] = useState<Outing | null>(null);
  const [checking, setChecking] = useState(false); // looking up real train times
  // A finished new plan waiting for you to say "replace my current one".
  const [waiting, setWaiting] = useState<{ plan: RoutePlan; mode: "normal" | "calm"; train?: Departures; leftNow?: boolean; directions?: boolean; bingo?: boolean } | null>(null);

  // Where you start: a picked start point, or your live location (never asked for until you press the button).
  const [start, setStart] = useState<Point>(DOWNTOWN);
  const [user, setUser] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  // A location problem, shown right under the location button, with the next thing to do.
  const [locNote, setLocNote] = useState<{ text: string; action: "retry" | "pick" } | null>(null);
  const watchId = useRef<number | null>(null);
  const [mapCenter, setMapCenter] = useState<LatLng>(DOWNTOWN);

  // Map search
  const [stim, setStim] = useState(false);
  const [radius, setRadius] = useState(DEFAULT_RADIUS);
  const [includeAddOns, setIncludeAddOns] = useState(true);
  const [kind, setKind] = useState<KindId | null>(null);
  const [openGroup, setOpenGroup] = useState<(typeof GROUPS)[number]["id"] | null>(null); // the expanded chip group (one at a time)
  const [found, setFound] = useState<Found[]>([]);
  const [loading, setLoading] = useState(false);
  const [sheetNote, setSheetNote] = useState<{ text: string; tone: "info" | "warn" } | null>(null);
  const searchSeq = useRef(0); // only the latest search may fill the sheet
  const [searchKey, setSearchKey] = useState(0);
  const [now, setNow] = useState<Date | null>(null);

  // Hitlist and favorites (saved in this browser)
  const [hitlist, setHitlist] = useState<HitItem[]>([]);
  const [favorites, setFavorites] = useState<NearbyPlace[]>([]);
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [justAdded, setJustAdded] = useState<string | null>(null);

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
  function stopLocation(note: { text: string; action: "retry" | "pick" } | null = null) {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    setLocationOn(false);
    setUser(null);
    setLocating(false);
    setLocNote(note);
  }

  function locate() {
    if (!("geolocation" in navigator)) {
      setLocNote({ text: "This browser can't share your location.", action: "pick" });
      return;
    }
    setLocating(true);
    setLocNote(null);
    let first = true;
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (!inArea(here)) {
          stopLocation({ text: "You seem to be outside Greater Boston, where errandJaeger works. The map shows downtown Boston.", action: "pick" });
          setMapCenter(DOWNTOWN);
          return;
        }
        setLocating(false);
        setLocationOn(true);
        setUser(here);
        if (first) {
          first = false;
          setMapCenter(here);
          toast({ kind: "success", text: "Using your location.", next: "It stays on this phone." });
        }
      },
      (err) =>
        stopLocation(
          err.code === err.PERMISSION_DENIED
            ? { text: "Location is blocked for this site. You can allow it in your browser settings, or pick a start point.", action: "pick" }
            : err.code === err.TIMEOUT
              ? { text: "Finding your location took too long.", action: "retry" }
              : { text: "Couldn't find your location right now.", action: "retry" },
        ),
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
    const seq = ++searchSeq.current;
    setKind(k);
    setLoading(true);
    setSheetNote(null);
    setFound([]);
    const from = searchFrom;
    setMapCenter({ lat: from.lat, lng: from.lng });
    const res = await fetchNearby(k, from, r);
    if (seq !== searchSeq.current) return; // you already asked for something else
    let places = res?.places ?? localFallback(k);
    if (!res) {
      setSheetNote({ text: navigator.onLine ? "Couldn't reach the places server, so these are from our own small list." : "You're offline, so these are from our own small list.", tone: "warn" });
    } else if (res.ok === false && res.reason === "rate-limited") {
      places = localFallback(k);
      setSheetNote({ text: "Lots of searches at once. Wait a few seconds, then try again.", tone: "warn" });
    } else if (res.source === "snapshot") {
      setSheetNote({ text: "The live map server is busy, so these are saved places (they may be a little out of date).", tone: "info" });
    } else if (res.source === "list") {
      setSheetNote({ text: "Couldn't reach the map server, so these are from our own small list.", tone: "info" });
    }

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
    if (hitIds.includes(p.id)) {
      const before = hitlist;
      updateHitlist(hitlist.filter((h) => h.id !== p.id));
      toast({ kind: "info", text: `Removed ${p.name}.`, action: { label: "Undo", onClick: () => updateHitlist(before) } });
      return;
    }
    if (hitlist.length >= MAX_HITLIST) {
      toast({ kind: "error", text: `Your hitlist is full (${MAX_HITLIST} places).`, next: "Remove one to add another." });
      return;
    }
    const { id, name, kind: k, lat, lng, hours, hoursVerified, source } = p;
    const before = hitlist;
    updateHitlist([...hitlist, { id, name, kind: k, lat, lng, hours, hoursVerified, source }]);
    toast({ kind: "success", text: `Added ${p.name} to your hitlist.`, action: { label: "Undo", onClick: () => updateHitlist(before) } });
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
    toast({
      kind: "success",
      text: favIds.includes(p.id) ? `Took the star off ${p.name}.` : `Starred ${p.name}.`,
      next: favIds.includes(p.id) ? undefined : "Starred places come first when Stim mode is off.",
    });
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
    setPlanBusy(true);
    try {
      await makePlanNow(values);
    } finally {
      setPlanBusy(false);
    }
  }

  // A plan problem: pinned to the screen with what to do next.
  function planProblem(text: string, next: string) {
    toast({ kind: "error", text, next });
  }

  async function makePlanNow(values: FormValues) {
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
        planProblem("Your hitlist only has add-ons.", "Turn on \"Include the add-ons\", or add an errand.");
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
      if (hitlist.length > 0 && estimated.skipped.length > 0) {
        planProblem(`No plan yet. ${estimated.skipped.map((s) => `${s.name}: ${s.reason}`).join(" ")}`, "Try another start time, or other places.");
      } else planProblem(`No plan yet. ${empty}`, "Change the time or what you picked, then try again.");
      return;
    }

    // Train rides: swap the estimated waits for the real scheduled times. If the lookup fails, the plan still works.
    let plan = estimated;
    let train: Departures | undefined;
    if (estimated.legs.some((l) => l.type === "transit")) {
      setChecking(true);
      const data = await fetchTrainData(estimated);
      plan = applyTrainData(estimated, data);
      if (!data) toast({ kind: "info", text: "Couldn't check train times.", next: "Your plan uses estimates. Check the MBTA before you go." });
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
  const quickFavs = favorites.filter((f) => !hitIds.includes(f.id));

  return (
    <main className={`home ${kind ? "has-sheet" : ""}`}>
      {current && !waiting && (
        <Link href="/plan" className="card resume">
          <strong>You have a plan in progress</strong>
          <span>
            {current.plan.stops.length} {current.plan.stops.length === 1 ? "stop" : "stops"} from {current.plan.start.name}. Continue
          </span>
        </Link>
      )}

      <Dialog
        open={!!waiting}
        title="Replace your plan in progress?"
        confirmLabel="Replace it"
        cancelLabel="Keep my plan"
        busy={planBusy}
        onCancel={() => {
          setWaiting(null);
          toast({ kind: "info", text: "Kept your current plan.", next: "Your new choices are still here." });
        }}
        onConfirm={() => waiting && saveAndGo(waiting.plan, waiting.mode, waiting.train, waiting.leftNow, waiting.directions, waiting.bingo)}
      >
        <p>Your new plan is ready. Replacing will clear the plan you already started, and its bingo ticks.</p>
      </Dialog>

      <div className={`map-wrap ${stim ? "is-lively" : "is-calm"}`}>
        <div className="cat-chips" aria-label="Search nearby" role="group">
          <div className="cat-groups">
            {GROUPS.map((g) => {
              const isOpen = openGroup === g.id;
              const hasPick = !!kind && kindById(kind)?.group === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  className={`cat-chip cat-group-btn cat-${g.id} ${hasPick ? "has-pick" : ""}`}
                  aria-expanded={isOpen}
                  aria-controls={`cat-row-${g.id}`}
                  onClick={() => setOpenGroup(isOpen ? null : g.id)}
                >
                  {g.label}
                  <span className="caret" aria-hidden="true">
                    {isOpen ? "▴" : "▾"}
                  </span>
                </button>
              );
            })}
          </div>
          {GROUPS.filter((g) => g.id === openGroup).map((g) => (
            <div key={g.id} id={`cat-row-${g.id}`} className={`cat-row ${reducedMotion ? "" : "cat-row-in"}`} role="group" aria-label={`${g.label} options`}>
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
          <button type="button" className="locate-btn" aria-busy={locating} onClick={() => (usingLocation || locating ? stopLocation() : locate())}>
            {locating ? (
              <>
                <Spinner /> Finding you… (tap to stop)
              </>
            ) : usingLocation ? (
              "Stop using my location"
            ) : (
              "Use my location"
            )}
          </button>
        </div>
      </div>
      {hitlist.length === 0 && <p className="hint map-hint">Tap a place on the map or in the list to add it to your hitlist.</p>}
      {locNote && (
        <Banner
          tone="warn"
          action={
            locNote.action === "retry"
              ? { label: "Try again", onClick: locate }
              : {
                  label: "Pick a start point",
                  onClick: () => {
                    setLocNote(null);
                    const el = document.getElementById("start-picker");
                    el?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
                    (el?.querySelector("button") as HTMLButtonElement | null)?.focus({ preventScroll: true });
                  },
                }
          }
        >
          {locNote.text}
        </Banner>
      )}

      <BrainDump onAddNearest={addNearest} onShow={(k) => search(k)} />

      <section className="favs" aria-labelledby="favs-title">
        <h2 id="favs-title">{stim ? "Your favorites" : "Familiar favorites"}</h2>
        {favorites.length === 0 ? (
          <p className="soft">Star places (☆ in the map results) to see them here.</p>
        ) : quickFavs.length === 0 ? (
          <p className="soft">All your starred places are already in your hitlist.</p>
        ) : (
          <select
            className="fav-select"
            aria-label="Add a starred place to your hitlist"
            value=""
            onChange={(e) => {
              const f = favorites.find((x) => x.id === e.target.value);
              if (f) toggleHit(f);
            }}
          >
            <option value="">Add a starred place… ({quickFavs.length})</option>
            {quickFavs.map((f) => (
              <option key={f.id} value={f.id}>
                ★ {f.name} · {kindById(f.kind)?.label ?? ""}
              </option>
            ))}
          </select>
        )}
      </section>

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

      {prefs ? (
        <PlanForm
          initial={prefs}
          onSubmit={makePlan}
          start={start}
          onStart={pickStart}
          usingLocation={usingLocation}
          hitlistCount={hitlist.length}
          busy={planBusy}
          busyText={checking ? "Checking train times…" : "Making your plan…"}
          onClearHitlist={() => {
            const before = hitlist;
            updateHitlist([]);
            toast({ kind: "info", text: "Cleared your hitlist.", next: "Pick by type below instead.", action: { label: "Undo", onClick: () => updateHitlist(before) } });
          }}
        />
      ) : (
        <Skeleton rows={2} label="Loading" />
      )}

      <div className="stim-row">
        <label className="switch">
          <input
            type="checkbox"
            role="switch"
            checked={stim}
            onChange={(e) => {
              setStim(e.target.checked);
              applyStim(e.target.checked);
              rememberSettings({ stim: e.target.checked });
            }}
          />
          <span className="switch-track" aria-hidden="true" />
          <span className="switch-label">
            Stim mode <strong>{stim ? "on" : "off"}</strong>
          </span>
        </label>
        <small>{stim ? "Livelier map, more places, side quests, your order." : "Fewer places, gentle fades, errands first."}</small>
      </div>

      {kind && now && (
        <NearbySheet
          title={`${kindLabel} within ${distLabel}`}
          loading={loading}
          note={sheetNote?.text ?? null}
          noteTone={sheetNote?.tone}
          onRetry={sheetNote && kind ? () => search(kind) : undefined}
          onWiden={radius < RADII[RADII.length - 1] ? () => chooseRadius(RADII[RADII.indexOf(radius) + 1]) : undefined}
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

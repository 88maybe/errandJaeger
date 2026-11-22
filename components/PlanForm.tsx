"use client";

import { useEffect, useState } from "react";
import { Spinner, Working } from "@/components/Busy";
import { aiParse } from "@/lib/ai/client";
import { FLAGS } from "@/lib/flags";
import { basicParse, hasAnything } from "@/lib/ai/fallback";
import type { ParsedRequest } from "@/lib/ai/validate";
import { START_POINTS } from "@/lib/planner/places";
import { nyParts } from "@/lib/planner/time";
import { NEED_LABEL } from "@/lib/planner/timeline";
import type { Need, Point } from "@/lib/planner/types";
import type { Prefs } from "@/lib/storage";

export type FormValues = {
  needs: Need[];
  startHHMM: string; // "14:30", Boston time (ignored when leaveNow is true)
  leaveNow?: boolean; // start = this moment
  loop: boolean;
  calm: boolean;
  bingo: boolean; // make a bingo card for this trip
  start: Point;
};

const NEED_ORDER: Need[] = ["grocery", "snack", "activity", "favorite"];

// The next quarter hour on the Boston clock, as "HH:MM".
function nextQuarterHour(): string {
  const minutes = Math.min(Math.ceil(nyParts(new Date()).minutes / 15) * 15, 23 * 60 + 45);
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

type Props = {
  initial: Prefs;
  onSubmit: (values: FormValues) => void;
  start: Point; // chosen on the Home page (a start point, or your location)
  onStart: (point: Point) => void;
  usingLocation: boolean;
  hitlistCount: number; // places picked on the map: when there are any, the plan visits those instead of "needs"
  busy?: boolean; // making the plan right now
  busyText?: string;
  onClearHitlist?: () => void; // plan by type instead
};

const INFO = {
  make: "Make my plan: plan for the start time I choose.",
  now: "Leave now: plan starting this minute, with live train times.",
};

export default function PlanForm({ initial, onSubmit, start, onStart, usingLocation, hitlistCount, busy = false, busyText = "Working…", onClearHitlist }: Props) {
  // Start from what you chose last time.
  const [needs, setNeeds] = useState<Need[]>(initial.needs);
  const [startHHMM, setStartHHMM] = useState("");
  const [loop, setLoop] = useState(initial.loop);
  const [calm, setCalm] = useState(initial.calm);
  const [bingo, setBingo] = useState(initial.bingo !== false);

  // "Tell me what you need today": text -> prefilled choices (you still confirm and press the button).
  const [text, setText] = useState("");
  const [reading, setReading] = useState(false);
  const [readNote, setReadNote] = useState<string | null>(null);
  const [info, setInfo] = useState<"make" | "now" | null>(null); // the open "i" explanation

  // Fill in the time after the page loads (so server and phone never disagree).
  useEffect(() => setStartHHMM(nextQuarterHour()), []);

  const toggleNeed = (need: Need) =>
    setNeeds((current) => (current.includes(need) ? current.filter((n) => n !== need) : [...current, need]));

  const hasSomething = needs.length > 0 || hitlistCount > 0;
  const ready = hasSomething && startHHMM !== "";

  // Fill the form from a parsed request. Anything the request didn't mention stays as it was.
  function applyParsed(p: ParsedRequest) {
    if (p.needs.length > 0) setNeeds(p.needs);
    if (p.startTime) setStartHHMM(p.startTime);
    const point = START_POINTS.find((s) => s.name === p.start);
    if (point) onStart(point);
    if (p.loop !== null) setLoop(p.loop);
    if (p.calm !== null) setCalm(p.calm);
  }

  async function readRequest() {
    if (!text.trim() || reading) return;
    setReading(true);
    setReadNote(null);

    // Try the AI first. If it is off, slow, or gives something unusable, use simple keyword matching instead.
    const asked = Date.now();
    const fromAi = await aiParse(text);
    const aiSlow = !fromAi && Date.now() - asked > 7000; // it gave up after waiting
    const parsed = fromAi && hasAnything(fromAi) ? fromAi : basicParse(text);
    setReading(false);

    if (!hasAnything(parsed)) {
      setReadNote("I couldn't pick anything out of that. You can use the buttons below instead.");
      return;
    }
    applyParsed(parsed);
    setReadNote(
      fromAi && hasAnything(fromAi)
        ? "I filled in the choices below. Please check them, then press Make my plan."
        : aiSlow
          ? "The AI helper took too long, so I filled in what I could with simple matching. Please check the choices below."
          : "I filled in what I could with simple matching. Please check the choices below.",
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onSubmit({ needs, startHHMM, loop, calm, bingo, start });
      }}
    >
      {FLAGS.tellMe && (
      <div className="tell">
        <label htmlFor="tell-me">Tell me what you need today</label>
        <textarea
          id="tell-me"
          rows={3}
          maxLength={500}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="For example: groceries and a coffee near Copley around 3pm, loop back, keep it calm"
        />
        <button type="button" className="btn btn-secondary tell-button" onClick={readRequest} disabled={reading || !text.trim()}>
          {reading ? (
            <>
              <Spinner /> Working…
            </>
          ) : (
            "Fill in the choices for me"
          )}
        </button>
        {!text.trim() && !reading && <p className="why-disabled">Type something above first.</p>}
        <Working busy={reading} text="Reading what you wrote…" slowText="Still reading. If the AI helper is slow, I'll use simple matching." />
        {readNote && (
          <p className="soft" role="status">
            {readNote}
          </p>
        )}
      </div>
      )}

      {hitlistCount === 0 && (
        <>
          <h2>What do you need today?</h2>
          <div className="chips">
            {NEED_ORDER.map((need) => (
              <button key={need} type="button" className="chip" aria-pressed={needs.includes(need)} onClick={() => toggleNeed(need)}>
                {NEED_LABEL[need]}
              </button>
            ))}
          </div>
        </>
      )}

      <h2 id="start-picker-title">Where are you starting?</h2>
      {usingLocation ? (
        <p className="soft">From your location (it stays on this phone).</p>
      ) : (
        <div className="chips" id="start-picker" role="group" aria-labelledby="start-picker-title">
          {START_POINTS.map((point) => (
            <button key={point.name} type="button" className="chip" aria-pressed={start.name === point.name} onClick={() => onStart(point)}>
              {point.name}
            </button>
          ))}
        </div>
      )}

      <h2>When do you want to start?</h2>
      <input className="time-input" type="time" value={startHHMM} onChange={(e) => setStartHHMM(e.target.value)} aria-label="Start time (Boston time)" />

      <label className="toggle">
        <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
        <span>Loop back to where I started</span>
      </label>
      <label className="toggle">
        <input type="checkbox" checked={calm} onChange={(e) => setCalm(e.target.checked)} />
        <span>
          Calmer mode
          <small>Shorter walks, and one step at a time</small>
        </span>
      </label>

      <label className="toggle">
        <input type="checkbox" checked={bingo} onChange={(e) => setBingo(e.target.checked)} />
        <span>
          Bingo card for this trip
          <small>Optional. Tick squares as you go, or just walk.</small>
        </span>
      </label>

      <div className="plan-actions">
        {hitlistCount > 0 && (
          <p className="plan-source">
            Planning from your hitlist ({hitlistCount} {hitlistCount === 1 ? "place" : "places"})
            {onClearHitlist && (
              <>
                {" · "}
                <button type="button" className="link-btn" onClick={onClearHitlist} disabled={busy}>
                  Clear
                </button>
              </>
            )}
          </p>
        )}
        {!hasSomething && <p className="why-disabled">Pick at least one thing above, or add places from the map, to make a plan.</p>}
        {hasSomething && !startHHMM && <p className="why-disabled">Choose a start time, or press Leave now.</p>}

        <div className="action-row">
          <button type="submit" className="btn btn-primary" disabled={!ready || busy} aria-busy={busy}>
            {busy ? (
              <>
                <Spinner /> Working…
              </>
            ) : (
              "Make my plan"
            )}
          </button>
          <InfoButton id="info-make" open={info === "make"} label="What does Make my plan do?" onToggle={() => setInfo(info === "make" ? null : "make")} />
        </div>
        {info === "make" && (
          <p id="info-make" className="info-line">
            {INFO.make}
          </p>
        )}

        <div className="action-row">
          <button type="button" className="btn btn-secondary" disabled={!hasSomething || busy} onClick={() => onSubmit({ needs, startHHMM, leaveNow: true, loop, calm, bingo, start })}>
            Leave now
          </button>
          <InfoButton id="info-now" open={info === "now"} label="What does Leave now do?" onToggle={() => setInfo(info === "now" ? null : "now")} />
        </div>
        {info === "now" && (
          <p id="info-now" className="info-line">
            {INFO.now}
          </p>
        )}
        <Working busy={busy} text={busyText} slowText="Still working. Train times can take a few seconds." />
      </div>
    </form>
  );
}

// A small "i" that shows a one-line explanation under its button.
function InfoButton({ id, open, label, onToggle }: { id: string; open: boolean; label: string; onToggle: () => void }) {
  return (
    <button type="button" className="info-btn" aria-expanded={open} aria-controls={id} aria-label={label} onClick={onToggle}>
      i
    </button>
  );
}

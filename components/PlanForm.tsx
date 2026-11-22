"use client";

import { useEffect, useState } from "react";
import { aiParse } from "@/lib/ai/client";
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
};

export default function PlanForm({ initial, onSubmit, start, onStart, usingLocation, hitlistCount }: Props) {
  // Start from what you chose last time.
  const [needs, setNeeds] = useState<Need[]>(initial.needs);
  const [startHHMM, setStartHHMM] = useState("");
  const [loop, setLoop] = useState(initial.loop);
  const [calm, setCalm] = useState(initial.calm);

  // "Tell me what you need today": text -> prefilled choices (you still confirm and press the button).
  const [text, setText] = useState("");
  const [reading, setReading] = useState(false);
  const [readNote, setReadNote] = useState<string | null>(null);

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
    const fromAi = await aiParse(text);
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
        : "I filled in what I could with simple matching. Please check the choices below.",
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onSubmit({ needs, startHHMM, loop, calm, start });
      }}
    >
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
          {reading ? "Reading…" : "Fill in the choices for me"}
        </button>
        {readNote && (
          <p className="soft" role="status">
            {readNote}
          </p>
        )}
      </div>

      {hitlistCount > 0 ? (
        <p className="soft plan-from-hitlist">
          Your plan will use your hitlist ({hitlistCount} {hitlistCount === 1 ? "place" : "places"}). Empty the hitlist to pick by type instead.
        </p>
      ) : (
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

      <h2>Where are you starting?</h2>
      {usingLocation ? (
        <p className="soft">From your location (it stays on this phone).</p>
      ) : (
        <div className="chips">
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

      <button type="submit" className="btn btn-primary" disabled={!ready}>
        Make my plan
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        disabled={!hasSomething}
        onClick={() => onSubmit({ needs, startHHMM, leaveNow: true, loop, calm, start })}
      >
        Leave now
      </button>
      {!hasSomething && <p className="hint">Pick at least one thing above, or add places from the map.</p>}
    </form>
  );
}

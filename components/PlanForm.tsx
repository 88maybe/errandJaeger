"use client";

import { useEffect, useState } from "react";
import { NEED_LABEL } from "@/lib/planner/timeline";
import { nyParts } from "@/lib/planner/time";
import type { Need } from "@/lib/planner/types";

export type FormValues = {
  needs: Need[];
  startHHMM: string; // "14:30", Boston time
  loop: boolean;
  calm: boolean;
};

const NEED_ORDER: Need[] = ["grocery", "snack", "activity", "favorite"];

// The next quarter hour on the Boston clock, as "HH:MM".
function nextQuarterHour(): string {
  const minutes = Math.min(Math.ceil(nyParts(new Date()).minutes / 15) * 15, 23 * 60 + 45);
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

export default function PlanForm({ onSubmit }: { onSubmit: (values: FormValues) => void }) {
  const [needs, setNeeds] = useState<Need[]>([]);
  const [startHHMM, setStartHHMM] = useState("");
  const [loop, setLoop] = useState(true);
  const [calm, setCalm] = useState(false);

  // Fill in the time after the page loads (so server and phone never disagree).
  useEffect(() => setStartHHMM(nextQuarterHour()), []);

  const toggleNeed = (need: Need) =>
    setNeeds((current) => (current.includes(need) ? current.filter((n) => n !== need) : [...current, need]));

  const ready = needs.length > 0 && startHHMM !== "";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onSubmit({ needs, startHHMM, loop, calm });
      }}
    >
      <h2>What do you need today?</h2>
      <div className="chips">
        {NEED_ORDER.map((need) => (
          <button
            key={need}
            type="button"
            className="chip"
            aria-pressed={needs.includes(need)}
            onClick={() => toggleNeed(need)}
          >
            {NEED_LABEL[need]}
          </button>
        ))}
      </div>

      <h2>When do you want to start?</h2>
      <input
        className="time-input"
        type="time"
        value={startHHMM}
        onChange={(e) => setStartHHMM(e.target.value)}
        aria-label="Start time (Boston time)"
      />

      <label className="toggle">
        <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
        <span>Loop back to where I started</span>
      </label>
      <label className="toggle">
        <input type="checkbox" checked={calm} onChange={(e) => setCalm(e.target.checked)} />
        <span>
          Calmer mode
          <small>Shorter walks only, for now</small>
        </span>
      </label>

      <button type="submit" className="primary" disabled={!ready}>
        Make my plan
      </button>
      {needs.length === 0 && <p className="muted hint">Pick at least one thing above.</p>}
    </form>
  );
}

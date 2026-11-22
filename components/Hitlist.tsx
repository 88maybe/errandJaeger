"use client";

import { kindById } from "@/lib/nearby/categories";
import { isMission } from "@/lib/nearby/client";
import type { HitItem } from "@/lib/storage";

type Props = {
  items: HitItem[];
  stim: boolean;
  includeAddOns: boolean;
  justAdded: string | null;
  reducedMotion: boolean;
  onMove: (index: number, by: -1 | 1) => void;
  onRemove: (id: string) => void;
  onIncludeAddOns: (value: boolean) => void;
};

// The tray of places you picked. Errands are the missions; treats and wellbeing are add-ons (rewards).
export default function Hitlist({ items, stim, includeAddOns, justAdded, reducedMotion, onMove, onRemove, onIncludeAddOns }: Props) {
  if (items.length === 0) {
    return <p className="hint">Tap a place on the map or in the list to add it to your hitlist.</p>;
  }
  const hasAddOns = items.some((p) => !isMission(p));
  return (
    <section className="hitlist" aria-label="Your hitlist">
      <h2>Your hitlist</h2>
      <p className="soft">
        {stim
          ? "The plan visits these in this order."
          : "The plan does the errands first, in this order, then the add-ons."}
      </p>
      <ol>
        {items.map((p, i) => (
          <li key={p.id} className={`hit ${justAdded === p.id && !reducedMotion ? "hit-new" : ""}`}>
            <span className={`hit-tag ${isMission(p) ? "tag-mission" : "tag-addon"}`}>{isMission(p) ? "Mission" : "Add-on"}</span>
            <span className="hit-name">
              {p.name}
              <small>{kindById(p.kind)?.label}</small>
            </span>
            <span className="hit-buttons">
              <button type="button" onClick={() => onMove(i, -1)} disabled={i === 0} aria-label={`Move ${p.name} up`}>
                ↑
              </button>
              <button type="button" onClick={() => onMove(i, 1)} disabled={i === items.length - 1} aria-label={`Move ${p.name} down`}>
                ↓
              </button>
              <button type="button" onClick={() => onRemove(p.id)} aria-label={`Remove ${p.name}`}>
                ✕
              </button>
            </span>
          </li>
        ))}
      </ol>
      {!stim && hasAddOns && (
        <label className="toggle">
          <input type="checkbox" checked={includeAddOns} onChange={(e) => onIncludeAddOns(e.target.checked)} />
          <span>
            Include the add-ons
            <small>Optional. Errands come first either way.</small>
          </span>
        </label>
      )}
    </section>
  );
}

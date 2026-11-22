"use client";

import { useState } from "react";
import { aiBrainDump } from "@/lib/ai/client";
import { basicDump, type DumpItem } from "@/lib/ai/braindump";
import { kindById, type KindId } from "@/lib/nearby/categories";

type Props = {
  onAddNearest: (kind: KindId) => Promise<string>; // adds the nearest good match; returns a short note
  onShow: (kind: KindId) => void; // opens the map search for that kind
};

// Type a messy list; get category chips to confirm. The AI only picks categories and quotes your words.
export default function BrainDump({ onAddNearest, onShow }: Props) {
  const [text, setText] = useState("");
  const [items, setItems] = useState<DumpItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function sort() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setNote(null);
    setNotes({});
    const fromAi = await aiBrainDump(text);
    const list = fromAi && fromAi.length > 0 ? fromAi : basicDump(text);
    setBusy(false);
    setItems(list);
    setNote(
      list.length === 0
        ? "I couldn't match anything to our categories. Try the chips on the map."
        : fromAi && fromAi.length > 0
          ? "Here's what I found. Confirm the ones you want."
          : "Sorted with simple matching. Confirm the ones you want.",
    );
  }

  async function add(item: DumpItem) {
    setNotes((n) => ({ ...n, [item.kind]: "Looking nearby…" }));
    const result = await onAddNearest(item.kind);
    setNotes((n) => ({ ...n, [item.kind]: result }));
  }

  return (
    <details className="braindump">
      <summary>Brain dump: type your messy list</summary>
      <textarea
        rows={3}
        maxLength={800}
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="Your messy list"
        placeholder="e.g. pick up meds, need cash, milk and eggs, maybe a matcha after"
      />
      <button type="button" className="btn btn-secondary" onClick={sort} disabled={busy || !text.trim()}>
        {busy ? "Sorting…" : "Sort it into chips"}
      </button>
      {note && (
        <p className="soft" role="status">
          {note}
        </p>
      )}
      {items.length > 0 && (
        <ul className="dump-chips">
          {items.map((item) => (
            <li key={item.kind} className="dump-chip">
              <div className="dump-main">
                <strong>{kindById(item.kind)?.label}</strong>
                {item.words && <span className="soft">&ldquo;{item.words}&rdquo;</span>}
                {notes[item.kind] && <span className="soft">{notes[item.kind]}</span>}
              </div>
              <div className="dump-actions">
                <button type="button" className="btn btn-primary btn-small" onClick={() => add(item)}>
                  Add nearest
                </button>
                <button type="button" className="btn btn-secondary btn-small" onClick={() => onShow(item.kind)}>
                  Choose
                </button>
                <button type="button" className="dump-x" aria-label={`Remove ${kindById(item.kind)?.label}`} onClick={() => setItems((l) => l.filter((x) => x.kind !== item.kind))}>
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

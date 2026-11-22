"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner, Working } from "@/components/Busy";
import { aiBrainDump } from "@/lib/ai/client";
import { basicDump, type DumpItem } from "@/lib/ai/braindump";
import { kindById, type KindId } from "@/lib/nearby/categories";

type Props = {
  onAddNearest: (kind: KindId) => Promise<string>; // adds the nearest good match; returns a short note
  onShow: (kind: KindId) => void; // opens the map search for that kind
};

const TITLE = "Brain dump: type your messy list";

// Type a messy list; get category chips to confirm. The AI only picks categories and quotes your words.
// Opens as a sheet: the header (with Close) stays put, the content scrolls inside.
export default function BrainDump({ onAddNearest, onShow }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [items, setItems] = useState<DumpItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState<string | null>(null);
  const chipsRef = useRef<HTMLUListElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  function close() {
    setOpen(false);
    requestAnimationFrame(() => openerRef.current?.focus({ preventScroll: true }));
  }

  // Focus the text box on open; Escape closes.
  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => textRef.current?.focus({ preventScroll: true }));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function sort() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setNote(null);
    setNotes({});
    const asked = Date.now();
    const fromAi = navigator.onLine ? await aiBrainDump(text) : null;
    const slow = !fromAi && Date.now() - asked > 7000;
    const list = fromAi && fromAi.length > 0 ? fromAi : basicDump(text);
    setBusy(false);
    setItems(list);
    setNote(
      list.length === 0
        ? "I couldn't match anything to our categories (groceries, pharmacy, laundry, bank, coffee, boba, dessert, park, library, museum). Try the chips on the map."
        : fromAi && fromAi.length > 0
          ? "Here's what I found. Confirm the ones you want."
          : !navigator.onLine
            ? "You're offline, so I sorted it with simple matching. Confirm the ones you want."
            : slow
              ? "The AI helper took too long, so I sorted it with simple matching. Confirm the ones you want."
              : "Sorted with simple matching. Confirm the ones you want.",
    );
    // Bring the new chips into view (inside the sheet).
    requestAnimationFrame(() => chipsRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" }));
  }

  async function add(item: DumpItem) {
    setAdding(item.kind);
    setNotes((n) => ({ ...n, [item.kind]: "" }));
    const result = await onAddNearest(item.kind);
    setAdding(null);
    setNotes((n) => ({ ...n, [item.kind]: result }));
  }

  return (
    <>
      <button ref={openerRef} type="button" className="dump-open" aria-expanded={open} aria-controls="braindump-sheet" onClick={() => setOpen(true)}>
        <span>
          {TITLE}
          <small>{items.length > 0 ? `${items.length} ${items.length === 1 ? "thing" : "things"} sorted. Tap to see them.` : "I'll sort it into places to pick from."}</small>
        </span>
        <span aria-hidden="true">›</span>
      </button>

      {open && (
        <>
          <div className="dump-scrim" onClick={close} aria-hidden="true" />
          <section id="braindump-sheet" className="dump-sheet" role="dialog" aria-modal="false" aria-labelledby="braindump-title">
            <div className="dump-head">
              <h2 id="braindump-title">{TITLE}</h2>
              <button type="button" className="sheet-close" onClick={close}>
                Close
              </button>
            </div>
            <div className="dump-body">
              <textarea
                ref={textRef}
                rows={3}
                maxLength={800}
                value={text}
                onChange={(e) => setText(e.target.value)}
                aria-label="Your messy list"
                placeholder="e.g. pick up meds, need cash, milk and eggs, maybe a matcha after"
              />
              <button type="button" className="btn btn-primary" onClick={sort} disabled={busy || !text.trim()}>
                {busy ? (
                  <>
                    <Spinner /> Working…
                  </>
                ) : (
                  "Sort it into chips"
                )}
              </button>
              {!text.trim() && <p className="why-disabled">Type your list above first.</p>}
              <Working busy={busy} text="Sorting your list…" slowText="Still sorting. If the AI helper is slow, I'll use simple matching." />
              {note && (
                <p className="soft" role="status">
                  {note}
                </p>
              )}
              {items.length > 0 && (
                <ul className="dump-chips" ref={chipsRef}>
                  {items.map((item) => (
                    <li key={item.kind} className="dump-chip">
                      <div className="dump-main">
                        <strong>{kindById(item.kind)?.label}</strong>
                        {item.words && <span className="soft">&ldquo;{item.words}&rdquo;</span>}
                        {adding === item.kind ? (
                          <span className="soft">
                            <Spinner /> Looking nearby…
                          </span>
                        ) : (
                          notes[item.kind] && (
                            <span className="soft" role="status">
                              {notes[item.kind]}
                            </span>
                          )
                        )}
                      </div>
                      <div className="dump-actions">
                        <button type="button" className="btn btn-primary btn-small" onClick={() => add(item)} disabled={adding !== null}>
                          {adding === item.kind ? "Working…" : "Add nearest"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-small"
                          onClick={() => {
                            setOpen(false); // the map results sheet takes over; your chips stay here for later
                            onShow(item.kind);
                          }}
                        >
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
            </div>
          </section>
        </>
      )}
    </>
  );
}

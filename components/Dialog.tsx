"use client";

import { useEffect, useId, useRef } from "react";

// An in-page dialog (never the browser's alert/confirm). Uses the native <dialog>: focus stays inside,
// Escape or the backdrop closes it, and focus goes back to the button you tapped.
type Props = {
  open: boolean;
  title: string;
  children?: React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean; // the confirm button removes something
  busy?: boolean;
};

export default function Dialog({ open, title, children, confirmLabel, cancelLabel, onConfirm, onCancel, danger, busy }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onCancel(); // tap outside the box
      }}
    >
      <div className="dialog-box">
        <h2 id={titleId}>{title}</h2>
        {children}
        <div className="dialog-buttons">
          {/* The safe choice comes first and gets focus. */}
          <button type="button" className="btn btn-secondary" onClick={onCancel} autoFocus>
            {cancelLabel}
          </button>
          <button type="button" className={`btn ${danger ? "btn-danger" : "btn-primary"}`} onClick={onConfirm} disabled={busy}>
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

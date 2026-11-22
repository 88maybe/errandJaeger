"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

// Messages pinned to the visible screen (bottom, above the tab bar), so they never appear off-screen.
// Successes go away after a few seconds; errors stay until you dismiss them. Screen readers hear them politely.

export type ToastKind = "success" | "error" | "info";
export type ToastInput = {
  kind: ToastKind;
  text: string; // what happened, in plain words
  next?: string; // what to do next (optional)
  action?: { label: string; onClick: () => void }; // e.g. Retry, Undo
  id?: string; // same id replaces the earlier message (e.g. "offline")
};
type Toast = ToastInput & { id: string };

const ToastContext = createContext<(t: ToastInput) => void>(() => {});
const DismissContext = createContext<(id: string) => void>(() => {});
export const useToast = () => useContext(ToastContext);
export const useDismissToast = () => useContext(DismissContext);

const SUCCESS_MS = 4500;
const MAX = 3;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const show = useCallback(
    (input: ToastInput) => {
      const id = input.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((list) => [...list.filter((t) => t.id !== id), { ...input, id }].slice(-MAX));
      clearTimeout(timers.current.get(id));
      if (input.kind !== "error") timers.current.set(id, setTimeout(() => dismiss(id), SUCCESS_MS));
    },
    [dismiss],
  );

  // Going offline (and back) is announced wherever you are.
  useEffect(() => {
    const off = () =>
      show({ id: "offline", kind: "error", text: "You're offline.", next: "Your saved plan still works. Searching, directions and train times need a connection." });
    const on = () => {
      dismiss("offline");
      show({ id: "online", kind: "success", text: "You're back online." });
    };
    if (!navigator.onLine) off();
    window.addEventListener("offline", off);
    window.addEventListener("online", on);
    return () => {
      window.removeEventListener("offline", off);
      window.removeEventListener("online", on);
    };
  }, [show, dismiss]);

  return (
    <ToastContext.Provider value={show}>
      <DismissContext.Provider value={dismiss}>
        {children}
        <div className="toasts" role="status" aria-live="polite" aria-atomic="false">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast-${t.kind}`}>
              <span className="toast-icon" aria-hidden="true">
                {t.kind === "success" ? "✓" : t.kind === "error" ? "!" : "i"}
              </span>
              <div className="toast-text">
                <strong>{t.text}</strong>
                {t.next && <span>{t.next}</span>}
              </div>
              {t.action && (
                <button
                  type="button"
                  className="toast-action"
                  onClick={() => {
                    dismiss(t.id);
                    t.action!.onClick();
                  }}
                >
                  {t.action.label}
                </button>
              )}
              <button type="button" className="toast-close" aria-label="Dismiss message" onClick={() => dismiss(t.id)}>
                ✕
              </button>
            </div>
          ))}
        </div>
      </DismissContext.Provider>
    </ToastContext.Provider>
  );
}

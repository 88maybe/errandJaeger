"use client";

import { useEffect, useState } from "react";

// A small spinner (a ring of dots in No-stim; it only fades when motion is reduced).
export function Spinner({ label }: { label?: string }) {
  return <span className="spinner" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} />;
}

// True once something has been busy for longer than `ms`.
export function useSlow(busy: boolean, ms = 4000): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    setSlow(false);
    if (!busy) return;
    const t = setTimeout(() => setSlow(true), ms);
    return () => clearTimeout(t);
  }, [busy, ms]);
  return slow;
}

// "Working…" line with a spinner, and a gentle "still working" after a few seconds.
export function Working({ busy, text, slowText }: { busy: boolean; text: string; slowText?: string }) {
  const slow = useSlow(busy);
  if (!busy) return null;
  return (
    <p className="working" role="status">
      <Spinner /> {text}
      {slow && <span className="still-working">{slowText ?? "Still working. This can take a few seconds."}</span>}
    </p>
  );
}

// Grey placeholder cards while something loads.
export function Skeleton({ rows = 3, label }: { rows?: number; label: string }) {
  return (
    <div className="skeletons" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton">
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}

// A small, friendly notice that sits right next to the results it is about.
export function Banner({ tone = "info", children, action }: { tone?: "info" | "warn"; children: React.ReactNode; action?: { label: string; onClick: () => void } }) {
  return (
    <div className={`inline-banner banner-${tone}`} role="status">
      <span className="banner-icon" aria-hidden="true">
        {tone === "warn" ? "!" : "i"}
      </span>
      <span className="banner-text">{children}</span>
      {action && (
        <button type="button" className="banner-action" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}

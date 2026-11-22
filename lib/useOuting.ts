"use client";

// Loads the current outing from storage and gives back a function to update it.
import { useCallback, useEffect, useRef, useState } from "react";
import { getOuting, saveOuting, type Outing } from "./storage";

export function useOuting() {
  const [outing, setOuting] = useState<Outing | null>(null);
  const [loaded, setLoaded] = useState(false);
  const latest = useRef<Outing | null>(null); // always the newest outing, even inside async code

  useEffect(() => {
    let alive = true;
    getOuting().then((o) => {
      if (alive) {
        latest.current = o;
        setOuting(o);
        setLoaded(true);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  // Pass a new outing, or a function that receives the newest one (safe to call after a slow AI request).
  const update = useCallback((next: Outing | ((prev: Outing) => Outing)) => {
    const value = typeof next === "function" ? (latest.current ? next(latest.current) : null) : next;
    if (!value) return;
    latest.current = value;
    setOuting(value);
    void saveOuting(value);
  }, []);

  return { outing, loaded, update };
}

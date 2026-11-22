"use client";

// Loads the current outing from storage and gives back a function to update it.
import { useCallback, useEffect, useState } from "react";
import { getOuting, saveOuting, type Outing } from "./storage";

export function useOuting() {
  const [outing, setOuting] = useState<Outing | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    getOuting().then((o) => {
      if (alive) {
        setOuting(o);
        setLoaded(true);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  // Update the screen straight away, and save in the background.
  const update = useCallback((next: Outing) => {
    setOuting(next);
    void saveOuting(next);
  }, []);

  return { outing, loaded, update };
}

"use client";

import { useEffect } from "react";
import { applyStim } from "@/lib/stim";
import { getPrefs } from "@/lib/storage";

// On every page load: apply your saved Stim mode to the whole app.
export default function StimSync() {
  useEffect(() => {
    getPrefs().then((p) => applyStim(!!p.stim));
  }, []);
  return null;
}

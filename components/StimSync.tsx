"use client";

import { useEffect } from "react";
import { applyStim } from "@/lib/stim";
import { getPrefs } from "@/lib/storage";
import { applyTheme, getTheme } from "@/lib/theme";

// On every page: apply your saved Stim mode and theme, and follow the phone's setting when the theme is Auto.
export default function StimSync() {
  useEffect(() => {
    getPrefs().then((p) => applyStim(!!p.stim));
    applyTheme(getTheme());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => getTheme() === "auto" && applyTheme("auto");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return null;
}

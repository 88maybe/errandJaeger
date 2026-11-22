"use client";

import { useEffect, useState } from "react";

// The theme actually showing ("light" or "dark"), kept in step with the <html data-theme> attribute.
export function useResolvedTheme(): "light" | "dark" {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const read = () => setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return theme;
}

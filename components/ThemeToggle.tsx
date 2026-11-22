"use client";

import { useEffect, useState } from "react";
import { getTheme, setTheme, type ThemeChoice } from "@/lib/theme";

const CHOICES: { id: ThemeChoice; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "auto", label: "Auto" },
];

// Light / Dark / Auto (Auto follows your phone). Remembered between visits.
export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [choice, setChoice] = useState<ThemeChoice>("light");
  useEffect(() => {
    setChoice(getTheme());
    const on = () => setChoice(getTheme());
    window.addEventListener("ej-theme", on);
    return () => window.removeEventListener("ej-theme", on);
  }, []);
  return (
    <div className={`segmented theme-toggle ${compact ? "compact" : ""}`} role="group" aria-label="Colour theme">
      {CHOICES.map((c) => (
        <button
          key={c.id}
          type="button"
          aria-pressed={choice === c.id}
          onClick={() => {
            setChoice(c.id);
            setTheme(c.id);
          }}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

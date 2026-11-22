"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";

// A tiny pixel mark: a walker's path with two stops (drawn on a 10×10 grid, no outside logos).
function PixelMark({ size = 24 }: { size?: number }) {
  const px: [number, number, string][] = [
    [1, 1, "var(--errands)"], [2, 1, "var(--errands)"], [1, 2, "var(--errands)"], [2, 2, "var(--errands)"],
    [3, 3, "var(--ink)"], [4, 4, "var(--ink)"], [5, 4, "var(--ink)"], [6, 5, "var(--ink)"],
    [7, 7, "var(--treats)"], [8, 7, "var(--treats)"], [7, 8, "var(--treats)"], [8, 8, "var(--treats)"],
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" shapeRendering="crispEdges" aria-hidden="true">
      {px.map(([x, y, c]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={c} />
      ))}
    </svg>
  );
}

// The landing page gets the big pixel wordmark; every other screen a thin bar with the small logo.
export default function AppBar() {
  const path = usePathname();
  if (path === "/") {
    return (
      <header className="app-bar app-bar-home">
        <h1 className="wordmark">
          <span className="wm-a">Errand</span> <span className="wm-b">Jaeger</span>
        </h1>
        <div className="app-bar-row">
          <p>Boundless energy, bound to the plan.</p>
          <ThemeToggle compact />
        </div>
      </header>
    );
  }
  return (
    <header className="app-bar app-bar-thin">
      <Link href="/" className="mini-logo" aria-label="Errand Jaeger home">
        <PixelMark />
        <span>Errand Jaeger</span>
      </Link>
    </header>
  );
}

// Ranks and badges. Our own names, plain code, worked out from finished outings (nothing is stored separately).
import { CORE_EXTRAS, MORE_EXTRAS } from "./bingo";
import type { Outing } from "./storage";

// A gentle progression by number of finished outings.
export const RANKS = [
  { min: 0, name: "Doorstep Starter", note: "Every walk starts at the door." },
  { min: 1, name: "First Stroller", note: "You made it out. That counts." },
  { min: 3, name: "Corner Scout", note: "You know a few corners now." },
  { min: 6, name: "Block Wanderer", note: "The blocks are getting familiar." },
  { min: 10, name: "Neighborhood Navigator", note: "You find your way around." },
  { min: 20, name: "City Pathfinder", note: "You've walked a lot of the city." },
  { min: 35, name: "Seasoned Explorer", note: "Experienced, and still curious." },
];

export function rankFor(outings: number) {
  const index = RANKS.reduce((best, r, i) => (outings >= r.min ? i : best), 0);
  const next = RANKS[index + 1] ?? null;
  return { ...RANKS[index], level: index + 1, next, toNext: next ? next.min - outings : 0 };
}

// Badges for the "notice the world" squares. Earned the first time you tick that square.
export const BADGES: { square: string; name: string; icon: string }[] = [
  { square: CORE_EXTRAS[0], name: "Snapshot Keeper", icon: "◎" },
  { square: CORE_EXTRAS[1], name: "Side Street Seeker", icon: "↝" },
  { square: CORE_EXTRAS[2], name: "Slow Breather", icon: "◌" },
  { square: MORE_EXTRAS[0], name: "Green Spotter", icon: "❦" },
  { square: MORE_EXTRAS[1], name: "Bench Rester", icon: "▭" },
  { square: MORE_EXTRAS[2], name: "Sound Catcher", icon: "♪" },
  { square: MORE_EXTRAS[3], name: "Door Detective", icon: "▯" },
  { square: MORE_EXTRAS[4], name: "Thank-You Giver", icon: "♡" },
  { square: MORE_EXTRAS[5], name: "Smile Finder", icon: "☺" },
];

export function badgeCounts(history: Outing[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const o of history) {
    if (!o.finishedAt) continue;
    for (const i of o.ticked) {
      const sq = o.card[i];
      if (sq?.kind === "extra") counts[sq.label] = (counts[sq.label] ?? 0) + 1;
    }
  }
  return counts;
}

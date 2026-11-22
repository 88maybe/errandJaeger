// Builds the 3x3 bingo card and checks for wins. Plain code, no AI.
import type { RoutePlan } from "./planner/types";

export type Square = {
  id: string;
  label: string;
  kind: "stop" | "extra" | "free";
  place?: string; // for stop squares: the real place's short name (never changed by AI)
};

// Always on the card (as long as there is room): the three "fun extras".
export const CORE_EXTRAS = [
  "Take a photo of something you like",
  "Walk down a street you haven't tried",
  "Step outside and take 3 slow breaths",
];

// Extra gentle squares used to fill any space left over.
export const MORE_EXTRAS = [
  "Notice something green",
  "Sit down for a minute",
  "Listen for a sound you like",
  "Spot an interesting door",
  "Say thank you to someone",
  "Find something that makes you smile",
];

// A short name for a card square: "Boston Public Library (Central, Copley Sq)" -> "Boston Public Library".
export function shortName(name: string): string {
  return name.replace(/\s*\(.*\)\s*$/, "");
}

// Same seed in -> same shuffle out, so a card never changes between visits.
function seededRandom(seed: string): () => number {
  let h = 1779033703;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    // "mulberry32": a tiny, well-known random number generator
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(list: T[], random: () => number): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// 9 squares: 8 filled (stops first, extras fill the rest), shuffled, free space in the centre (index 4).
export function buildCard(plan: RoutePlan, seed: string): Square[] {
  const random = seededRandom(seed);

  const stopSquares: Square[] = plan.stops.slice(0, 8).map((s) => ({
    id: `stop-${s.place.id}`,
    label: shortName(s.place.name),
    kind: "stop",
    place: shortName(s.place.name),
  }));

  const extraLabels = [...CORE_EXTRAS, ...shuffle(MORE_EXTRAS, random)];
  const extraSquares: Square[] = extraLabels.slice(0, 8 - stopSquares.length).map((label, i) => ({
    id: `extra-${i}`,
    label,
    kind: "extra",
  }));

  const eight = shuffle([...stopSquares, ...extraSquares], random);
  const free: Square = { id: "free", label: "Free space", kind: "free" };
  return [...eight.slice(0, 4), free, ...eight.slice(4)];
}

// The 8 ways to win: 3 rows, 3 columns, 2 diagonals (as square positions 0-8).
export const LINES: number[][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

// Which squares count as done? Ticked ones, plus the free space.
export function doneFlags(card: Square[], ticked: number[]): boolean[] {
  return card.map((square, i) => square.kind === "free" || ticked.includes(i));
}

// The winning lines right now.
export function completedLines(card: Square[], ticked: number[]): number[][] {
  const done = doneFlags(card, ticked);
  return LINES.filter((line) => line.every((i) => done[i]));
}

export function isFullCard(card: Square[], ticked: number[]): boolean {
  return card.length === 9 && doneFlags(card, ticked).every(Boolean);
}

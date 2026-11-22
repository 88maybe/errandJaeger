// Brain dump: a messy typed list -> a few category chips (groceries, pharmacy, coffee, ...).
// Shared by the server route (checking the AI's answer) and the browser (the non-AI fallback).
// Only our own categories are allowed, and the chip text must be the user's OWN words. No places, no times.
import { KINDS, type KindId } from "../nearby/categories";

export type DumpItem = { kind: KindId; words: string }; // words: a short bit of what the user typed

const MAX_ITEMS = 8;
const KIND_IDS = KINDS.map((k) => k.id) as string[];

const WORDS: [KindId, RegExp][] = [
  ["groceries", /grocer|supermarket|milk|eggs|bread|veg|fruit|food shop|trader joe|whole foods|star market|shaw/i],
  ["pharmacy", /pharmac|prescription|meds?\b|medicine|cvs|walgreens|vitamin|chemist/i],
  ["laundry", /laundr|dry ?clean|wash (my )?clothes/i],
  ["bank", /\bbank|atm|cash|deposit|cheque|check\b/i],
  ["coffee", /coffee|latte|espresso|cappuccino|caf[eé]/i],
  ["boba", /boba|bubble tea|matcha|milk tea/i],
  ["dessert", /dessert|ice cream|gelato|cake|donut|doughnut|pastry|bakery|cookie|sweet/i],
  ["park", /park|garden|outside|fresh air|green space|sit by/i],
  ["library", /librar|book/i],
  ["museum", /museum|gallery|art\b|exhibit/i],
];

// Splits the text into short pieces (lines, commas, "and").
function pieces(text: string): string[] {
  return text
    .split(/[\n,;•\-–]+|\band\b|\bthen\b|\balso\b/i)
    .map((p) => p.trim())
    .filter((p) => p.length > 1)
    .slice(0, 30);
}

const short = (s: string) => s.split(/\s+/).slice(0, 6).join(" ").slice(0, 50);

export function basicDump(text: string): DumpItem[] {
  const out: DumpItem[] = [];
  for (const piece of pieces(text)) {
    const hit = WORDS.find(([, re]) => re.test(piece));
    if (hit && !out.some((o) => o.kind === hit[0])) out.push({ kind: hit[0], words: short(piece) });
  }
  return out.slice(0, MAX_ITEMS);
}

// Checks the AI's answer: allowed categories only, no repeats, and words that really come from the user's text.
export function validateDump(raw: unknown, text: string): DumpItem[] {
  const items = (raw as { items?: unknown })?.items;
  if (!Array.isArray(items)) return [];
  const lower = text.toLowerCase();
  const out: DumpItem[] = [];
  for (const it of items) {
    const kind = (it as { kind?: unknown })?.kind;
    const words = (it as { words?: unknown })?.words;
    if (typeof kind !== "string" || !KIND_IDS.includes(kind) || out.some((o) => o.kind === kind)) continue;
    // Every word of the chip text must appear in what the user typed; otherwise we show no words at all.
    const w = typeof words === "string" ? short(words.trim()) : "";
    const ownWords = w && w.toLowerCase().split(/\s+/).every((x) => lower.includes(x.replace(/[^\p{L}\p{N}']/gu, "")));
    out.push({ kind: kind as KindId, words: ownWords ? w : "" });
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

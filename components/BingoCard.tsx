import { completedLines, doneFlags } from "@/lib/bingo";
import type { Square } from "@/lib/bingo";

// The 3x3 card. Tap a square to tick or untick it.
// `groups` colours stop squares: errands Green, treats Orange, wellbeing Blue.
export default function BingoCard({
  card,
  ticked,
  onTap,
  groups = {},
}: {
  card: Square[];
  ticked: number[];
  onTap: (index: number) => void;
  groups?: Record<string, "errands" | "treats" | "wellbeing">;
}) {
  const done = doneFlags(card, ticked);
  const winning = new Set(completedLines(card, ticked).flat());

  return (
    <div className="bingo-grid">
      {card.map((square, i) => (
        <button
          key={square.id}
          type="button"
          className={`square ${square.kind} ${groups[square.id] ? `sq-${groups[square.id]}` : ""} ${done[i] ? "done" : ""} ${winning.has(i) ? "win" : ""}`}
          aria-pressed={done[i]}
          disabled={square.kind === "free"}
          onClick={() => onTap(i)}
        >
          <span className="square-tag">{square.kind === "stop" ? "Stop" : square.kind === "extra" ? "Extra" : "Free"}</span>
          <span className="square-label">{square.label}</span>
          {done[i] && (
            <svg className="square-check" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          )}
        </button>
      ))}
    </div>
  );
}

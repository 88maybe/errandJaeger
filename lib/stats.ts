// Stats and the reward message, worked out from finished outings. Plain code.
import { isFullCard } from "./bingo";
import type { Outing } from "./storage";
import { nyParts } from "./planner/time";

export type Stats = {
  outings: number;
  placesVisited: number;
  minutesWalked: number; // ESTIMATE: the planned walking time, not tracked
  streak: number; // days in a row with a finished outing
};

// A Boston calendar day as a whole number, so "tomorrow" is simply +1.
function dayNumber(date: Date): number {
  const { year, month, day } = nyParts(date);
  return Math.round(Date.UTC(year, month - 1, day) / 86400000);
}

// Streak = how many days in a row (ending today or yesterday) have at least one finished outing.
export function computeStreak(finishedDates: Date[], now: Date = new Date()): number {
  const days = [...new Set(finishedDates.map(dayNumber))].sort((a, b) => b - a); // newest first
  if (days.length === 0) return 0;

  const today = dayNumber(now);
  if (days[0] < today - 1) return 0; // last outing was before yesterday: streak is over

  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    if (days[i] === days[i - 1] - 1) streak++;
    else break;
  }
  return streak;
}

export function computeStats(history: Outing[], now: Date = new Date()): Stats {
  const finished = history.filter((o) => o.finishedAt);
  return {
    outings: finished.length,
    // Stop squares you ticked.
    placesVisited: finished.reduce(
      (sum, o) => sum + o.ticked.filter((i) => o.card[i]?.kind === "stop").length,
      0,
    ),
    minutesWalked: finished.reduce((sum, o) => sum + o.plan.legs.reduce((m, leg) => m + leg.durationMin, 0), 0),
    streak: computeStreak(finished.map((o) => new Date(o.finishedAt as string)), now),
  };
}

// A small, kind message for the done screen.
export function rewardMessage(stats: Stats, outing?: Outing): string {
  if (outing && isFullCard(outing.card, outing.ticked)) {
    return "A full card. That was a lot of small steps, and you took every one.";
  }
  if (stats.streak >= 3) return `${stats.streak} days in a row. Small steps add up.`;
  if (stats.outings === 1) return "Your first outing is done. Getting out the door is the hardest part.";
  return "Outing done. Resting now is part of the plan too.";
}

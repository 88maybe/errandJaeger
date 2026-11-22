import type { Stats } from "@/lib/stats";

export default function StatsCards({ stats }: { stats: Stats }) {
  const tiles = [
    { value: stats.outings, label: "Outings" },
    { value: stats.placesVisited, label: "Places visited" },
    { value: `~${stats.minutesWalked} min`, label: "Planned walking time (estimate)" },
    { value: stats.streak, label: "Day streak" },
  ];
  return (
    <div className="stats-grid">
      {tiles.map((tile) => (
        <div key={tile.label} className="stat">
          <strong>{tile.value}</strong>
          <span>{tile.label}</span>
        </div>
      ))}
    </div>
  );
}

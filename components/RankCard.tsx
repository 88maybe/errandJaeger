import { rankFor } from "@/lib/profile";

// Your rank, and how far it is to the next one.
export default function RankCard({ outings }: { outings: number }) {
  const rank = rankFor(outings);
  const prevMin = rank.min;
  const progress = rank.next ? (outings - prevMin) / (rank.next.min - prevMin) : 1;
  return (
    <section className="rank-card" aria-label="Your rank">
      <span className="rank-level">Level {rank.level}</span>
      <strong className="rank-name">{rank.name}</strong>
      <p className="soft">{rank.note}</p>
      {rank.next ? (
        <>
          <div className="rank-bar" role="img" aria-label={`${outings - prevMin} of ${rank.next.min - prevMin} outings to the next rank`}>
            <span style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="soft">
            {rank.toNext} more {rank.toNext === 1 ? "outing" : "outings"} to {rank.next.name}
          </p>
        </>
      ) : (
        <p className="soft">The top rank. Keep exploring at your own pace.</p>
      )}
    </section>
  );
}

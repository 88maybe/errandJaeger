"use client";

import { kindById } from "@/lib/nearby/categories";
import { distanceText, isMission, openStatus, type Found } from "@/lib/nearby/client";

type SideQuest = { place: Found } | null;

type Props = {
  title: string;
  loading: boolean;
  note: string | null;
  results: Found[];
  hitIds: string[];
  favIds: string[];
  stim: boolean;
  reducedMotion: boolean;
  searchKey: number;
  sideQuest: SideQuest;
  now: Date;
  onToggle: (p: Found) => void;
  onStar: (p: Found) => void;
  onClose: () => void;
};

// The bottom sheet with the search results. Cards slide up one after another (Stim mode), or just fade in.
export default function NearbySheet(props: Props) {
  const { title, loading, note, results, hitIds, favIds, stim, reducedMotion, searchKey, sideQuest, now, onToggle, onStar, onClose } = props;
  const anim = reducedMotion ? "" : stim ? "card-slide" : "card-fade";

  return (
    <section className={`sheet ${reducedMotion ? "" : "sheet-in"}`} aria-label={title} key={searchKey}>
      <div className="sheet-head">
        <span className="sheet-grip" aria-hidden="true" />
        <h2>{title}</h2>
        <button type="button" className="sheet-close" onClick={onClose} aria-label="Close the results">
          Close
        </button>
      </div>

      {loading && (
        <p className="soft" role="status">
          Looking nearby…
        </p>
      )}
      {note && <p className="soft">{note}</p>}
      {!loading && results.length === 0 && <p className="soft">Nothing found in this area. Try a bigger distance.</p>}

      {stim && sideQuest && !loading && (
        <div className={`side-quest ${anim}`}>
          <strong>Side quest</strong>
          <p>
            Somewhere new: {sideQuest.place.name}, about {sideQuest.place.walkMin} min walk (estimate).
          </p>
          <p className="soft">Or take a street you haven&apos;t walked before on the way.</p>
          {!hitIds.includes(sideQuest.place.id) && (
            <button type="button" className="btn btn-secondary btn-small" onClick={() => onToggle(sideQuest.place)}>
              Add it
            </button>
          )}
        </div>
      )}

      <ul className="sheet-list">
        {results.map((p, i) => {
          const status = openStatus(p, now);
          const added = hitIds.includes(p.id);
          const fav = favIds.includes(p.id);
          return (
            <li key={p.id} className={`place-card ${anim}`} style={{ animationDelay: reducedMotion ? undefined : `${Math.min(i, 10) * (stim ? 60 : 30)}ms` }}>
              <div className="place-main">
                <strong>{p.name}</strong>
                <span className="soft">
                  {kindById(p.kind)?.label} · {distanceText(p.distanceM)} · {p.walkMin} min walk (estimate)
                </span>
                <span className={`open-chip open-${status.tone}`}>{status.text}</span>
              </div>
              <div className="place-actions">
                <button type="button" className="star" aria-pressed={fav} aria-label={fav ? `Remove ${p.name} from favorites` : `Star ${p.name}`} onClick={() => onStar(p)}>
                  {fav ? "★" : "☆"}
                </button>
                <button type="button" className={`btn btn-small ${added ? "btn-secondary" : "btn-primary"}`} aria-pressed={added} onClick={() => onToggle(p)}>
                  {added ? "Added" : isMission(p) ? "Add errand" : "Add"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

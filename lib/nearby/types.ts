import type { KindId } from "./categories";

// One place from the map search. Facts only: name, position, opening hours. Never written by AI.
export type NearbyPlace = {
  id: string; // "osm-node-123" for OpenStreetMap, or our own id from data/places.json
  name: string;
  kind: KindId;
  lat: number;
  lng: number;
  hours: Record<string, string> | null; // our format; null = hours unknown
  hoursVerified: boolean; // true only for hand-checked places in our own list
  source: "osm" | "snapshot" | "list";
};

export type NearbyResponse = {
  ok: boolean;
  // "osm" = live OpenStreetMap; "snapshot" = a saved copy of OpenStreetMap (data/osm-snapshot.json);
  // "list" = our own small hand-written list. The last two are used when OpenStreetMap can't be reached.
  source: "osm" | "snapshot" | "list";
  places: NearbyPlace[];
  reason?: string;
};

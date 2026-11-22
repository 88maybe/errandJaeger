import data from "../../data/places.json";
import type { Place, Point } from "./types";

export const PLACES = data.places as unknown as Place[];

// Default start point: Kenmore Square.
export const KENMORE: Point = { name: "Kenmore Square", lat: 42.3489, lng: -71.0953 };

// Start points you can pick from. Any {name, lat, lng} works, so "use my location"
// or address search can supply one later without changing the planner.
export const START_POINTS: Point[] = [
  KENMORE,
  { name: "Copley Square", lat: 42.3499, lng: -71.0777 },
  { name: "Prudential Center", lat: 42.3471, lng: -71.0823 },
  { name: "Boston Common", lat: 42.355, lng: -71.0656 },
];

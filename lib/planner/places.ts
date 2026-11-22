import data from "../../data/places.json";
import type { Place, Point } from "./types";

export const PLACES = data.places as unknown as Place[];

// Default start point: Kenmore Square.
export const KENMORE: Point = { name: "Kenmore Square", lat: 42.3489, lng: -71.0953 };

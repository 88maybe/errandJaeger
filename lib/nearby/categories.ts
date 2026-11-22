// The map's category chips. Shared by the browser (chips, colours) and the server (what to ask OpenStreetMap for).
import type { Category } from "../planner/types";

// Errands are the missions. Treats and wellbeing are add-ons (rewards along the way).
export type Group = "errands" | "treats" | "wellbeing";

export type KindId = "groceries" | "pharmacy" | "laundry" | "bank" | "coffee" | "boba" | "dessert" | "park" | "library" | "museum";

export type Kind = {
  id: KindId;
  label: string;
  group: Group;
  category: Category; // what the planner calls it
  dwellMin: number; // ESTIMATE of time spent there
  // OpenStreetMap tag filters (Overpass syntax, without the "around" part). Any one of them matches.
  osm: string[];
  // Places from our own list (data/places.json) used when OpenStreetMap can't be reached.
  fallbackIds: string[];
};

export const GROUPS: { id: Group; label: string }[] = [
  { id: "errands", label: "Errands" },
  { id: "treats", label: "Treats" },
  { id: "wellbeing", label: "Wellbeing" },
];

export const KINDS: Kind[] = [
  {
    id: "groceries",
    label: "Groceries",
    group: "errands",
    category: "grocery",
    dwellMin: 20,
    osm: ['["shop"~"^(supermarket|grocery|greengrocer)$"]'],
    fallbackIds: ["trader-joes-boylston", "star-market-fenway", "whole-foods-fenway", "shaws-prudential", "boston-public-market"],
  },
  { id: "pharmacy", label: "Pharmacy", group: "errands", category: "errand", dwellMin: 10, osm: ['["amenity"="pharmacy"]', '["shop"="chemist"]'], fallbackIds: [] },
  { id: "laundry", label: "Laundry", group: "errands", category: "errand", dwellMin: 15, osm: ['["shop"~"^(laundry|dry_cleaning)$"]'], fallbackIds: [] },
  { id: "bank", label: "Bank / ATM", group: "errands", category: "errand", dwellMin: 5, osm: ['["amenity"~"^(bank|atm)$"]'], fallbackIds: [] },
  {
    id: "coffee",
    label: "Coffee",
    group: "treats",
    category: "snack",
    dwellMin: 15,
    osm: ['["amenity"="cafe"]'],
    fallbackIds: ["thinking-cup-newbury", "flour-bakery-clarendon", "tatte-boylston"],
  },
  {
    id: "boba",
    label: "Boba / matcha",
    group: "treats",
    category: "snack",
    dwellMin: 15,
    osm: ['["shop"="bubble_tea"]', '["cuisine"~"bubble_tea|matcha"]', '["amenity"~"^(cafe|fast_food)$"]["name"~"boba|bubble|matcha|tea",i]'],
    fallbackIds: [],
  },
  {
    id: "dessert",
    label: "Dessert",
    group: "treats",
    category: "snack",
    dwellMin: 15,
    osm: ['["amenity"="ice_cream"]', '["shop"~"^(pastry|bakery|confectionery|chocolate|ice_cream)$"]', '["cuisine"~"dessert|ice_cream|donut|frozen_yogurt"]'],
    fallbackIds: ["jp-licks-newbury", "flour-bakery-clarendon"],
  },
  {
    id: "park",
    label: "Park / garden",
    group: "wellbeing",
    category: "activity",
    dwellMin: 30,
    osm: ['["leisure"~"^(park|garden)$"]'],
    fallbackIds: ["boston-common", "public-garden", "back-bay-fens-rose-garden", "fenway-victory-gardens", "hatch-shell-esplanade"],
  },
  { id: "library", label: "Library", group: "wellbeing", category: "activity", dwellMin: 30, osm: ['["amenity"="library"]'], fallbackIds: ["bpl-central", "mapparium"] },
  {
    id: "museum",
    label: "Museum",
    group: "wellbeing",
    category: "activity",
    dwellMin: 60,
    osm: ['["tourism"~"^(museum|gallery)$"]'],
    fallbackIds: ["gardner-museum", "mfa-boston", "mapparium"],
  },
];

export const kindById = (id: string): Kind | undefined => KINDS.find((k) => k.id === id);

// Greater Boston, roughly (a box from Waltham to Winthrop, Quincy to Medford).
export const AREA = { south: 42.22, north: 42.46, west: -71.27, east: -70.95 };
export const DOWNTOWN = { name: "Downtown Boston", lat: 42.3555, lng: -71.0605 };
export const inArea = (p: { lat: number; lng: number }) => p.lat >= AREA.south && p.lat <= AREA.north && p.lng >= AREA.west && p.lng <= AREA.east;

// Only rounded coordinates ever go to our server: 3 decimals is about 100 m.
export const roundCoord = (n: number) => Math.round(n * 1000) / 1000;

export const RADII = [500, 1000, 2000]; // metres
export const DEFAULT_RADIUS = 1000;

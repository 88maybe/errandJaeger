// Finds a subway route between two stations. Plain code over the small hand-built map, no AI, no live data yet.
// Normal mode: the fastest way. Calm mode: the fewest changes first, then the fastest.
import { distanceMeters } from "../planner/geo";
import { LINES, STATIONS, platformName, stationById, type Line, type Station } from "./data";

// ESTIMATES (minutes). Real trains vary, and live times are not used yet.
export const WAIT_MIN = 5; // average wait for the next train
export const CHANGE_WALK_MIN = 3; // walking inside the station when changing lines
const SPEED_M_PER_MIN: Record<Line["family"], number> = { "Green Line": 250, "Orange Line": 450 };
const STOP_DWELL_MIN = 0.5; // each stop adds a little time
const CALM_CHANGE_PENALTY = 1000; // calm mode treats one extra change as worse than any ride time

export type Ride = {
  line: Line; // the line we picked
  sameWay: Line[]; // every line that covers this whole ride in the same direction (includes `line`)
  from: Station;
  to: Station;
  toward: string[]; // terminals to look for, one per line in sameWay
  platform: string; // where to board, the MBTA platform name
  stops: number; // how many stops you ride (not counting the one you board at)
  rideMin: number; // ESTIMATE
  waitMin: number; // ESTIMATE: wait for the train (plus the walk inside the station if this is a change)
  changeFrom: Station | null; // set when this ride starts with a change of lines
};

export type TransitRoute = { rides: Ride[]; changes: number; totalMin: number };

// The station closest to a point (straight-line distance).
export function nearestStation(point: { lat: number; lng: number }): Station {
  return STATIONS.reduce((best, s) => (distanceMeters(point, s) < distanceMeters(point, best) ? s : best));
}

const linesAt = (stationId: string) => LINES.filter((l) => l.stations.includes(stationId));

// Estimated minutes to ride one hop between two neighbouring stations on a line.
function hopMin(line: Line, a: string, b: string): number {
  const metres = distanceMeters(stationById(a), stationById(b)) * 1.15; // track isn't a straight line
  return metres / SPEED_M_PER_MIN[line.family] + STOP_DWELL_MIN;
}

type State = { station: string; line: string };
type Node = { cost: number; changes: number; prev: State | null; how: "board" | "ride" | "change" };

export function findRoute(fromId: string, toId: string, mode: "normal" | "calm"): TransitRoute | null {
  if (fromId === toId) return null;
  const key = (s: State) => `${s.station}|${s.line}`;
  const best = new Map<string, Node>();
  const queue: { state: State; node: Node }[] = [];
  const push = (state: State, node: Node) => {
    const old = best.get(key(state));
    if (old && old.cost <= node.cost) return;
    best.set(key(state), node);
    queue.push({ state, node });
  };
  const penalty = mode === "calm" ? CALM_CHANGE_PENALTY : 0;

  // Start: board any line at the first station.
  for (const l of linesAt(fromId)) push({ station: fromId, line: l.id }, { cost: WAIT_MIN, changes: 0, prev: null, how: "board" });

  // Small graph, so a simple "take the cheapest, relax its neighbours" loop is enough (Dijkstra).
  while (queue.length > 0) {
    queue.sort((a, b) => a.node.cost - b.node.cost);
    const { state, node } = queue.shift()!;
    if (best.get(key(state))!.cost < node.cost) continue; // an older, worse entry
    const line = LINES.find((l) => l.id === state.line)!;
    const i = line.stations.indexOf(state.station);

    // Ride to the next station either way along the line.
    for (const j of [i - 1, i + 1]) {
      if (j < 0 || j >= line.stations.length) continue;
      push(
        { station: line.stations[j], line: line.id },
        { cost: node.cost + hopMin(line, state.station, line.stations[j]), changes: node.changes, prev: state, how: "ride" },
      );
    }
    // Change to another line here.
    for (const other of linesAt(state.station)) {
      if (other.id === state.line) continue;
      push(
        { station: state.station, line: other.id },
        { cost: node.cost + CHANGE_WALK_MIN + WAIT_MIN + penalty, changes: node.changes + 1, prev: state, how: "change" },
      );
    }
  }

  // Cheapest way to be at the destination on any line.
  let end: { state: State; node: Node } | null = null;
  for (const l of linesAt(toId)) {
    const node = best.get(key({ station: toId, line: l.id }));
    if (node && (!end || node.cost < end.node.cost)) end = { state: { station: toId, line: l.id }, node };
  }
  if (!end) return null;

  // Walk back through "prev" to list the states in order.
  const path: { state: State; node: Node }[] = [];
  let cur: State | null = end.state;
  while (cur) {
    const node: Node = best.get(key(cur))!;
    path.unshift({ state: cur, node });
    cur = node.prev;
  }

  // Group into rides: a new ride starts at "board" and after each "change".
  const rides: Ride[] = [];
  let groupStart = 0;
  for (let p = 1; p <= path.length; p++) {
    if (p < path.length && path[p].node.how !== "change") continue;
    const first = path[groupStart];
    const last = path[p - 1];
    const line = LINES.find((l) => l.id === first.state.line)!;
    const idxFrom = line.stations.indexOf(first.state.station);
    const idxTo = line.stations.indexOf(last.state.station);
    if (idxFrom !== idxTo) {
      const toward = idxTo < idxFrom ? "first" : "last";
      const covering = LINES.filter((l) => {
        const a = l.stations.indexOf(first.state.station);
        const b = l.stations.indexOf(last.state.station);
        return a >= 0 && b >= 0 && Math.abs(b - a) === Math.abs(idxTo - idxFrom) && (b < a) === (idxTo < idxFrom);
      });
      // Only list lines that use the SAME platform, so "board at" and "toward" always agree.
      const platform = platformName(line, first.state.station, toward);
      const sameWay = (covering.some((l) => l.id === line.id) ? covering : [line]).filter(
        (l) => platformName(l, first.state.station, toward) === platform,
      );
      let rideMin = 0;
      for (let k = Math.min(idxFrom, idxTo); k < Math.max(idxFrom, idxTo); k++) {
        rideMin += hopMin(line, line.stations[k], line.stations[k + 1]);
      }
      const changed = groupStart > 0;
      rides.push({
        line,
        sameWay,
        from: stationById(first.state.station),
        to: stationById(last.state.station),
        toward: sameWay.map((l) => (toward === "first" ? l.towardFirst : l.towardLast)),
        platform,
        stops: Math.abs(idxTo - idxFrom),
        rideMin: Math.max(1, Math.round(rideMin)),
        waitMin: changed ? CHANGE_WALK_MIN + WAIT_MIN : WAIT_MIN,
        changeFrom: changed ? stationById(first.state.station) : null,
      });
    }
    groupStart = p;
  }

  const totalMin = rides.reduce((sum, r) => sum + r.waitMin + r.rideMin, 0);
  return { rides, changes: Math.max(0, rides.length - 1), totalMin };
}

// Run with: npm run check:planner
// Prints a sample plan so you can see the planner work before any screen exists.
import { planRoute } from "./index";
import { walkMinutes } from "./geo";
import { KENMORE, PLACES, START_POINTS } from "./places";
import { formatNY, nyParts, todayAtNY } from "./time";
import type { PlanInput, RoutePlan } from "./types";

function show(title: string, input: PlanInput) {
  const plan: RoutePlan = planRoute(input, PLACES);
  console.log(`\n=== ${title} ===`);
  console.log(`Needs: ${input.needs.join(", ")} | mode: ${input.mode ?? "normal"} | loop: ${input.loop}`);
  console.log(`Leave by ${formatNY(plan.leaveBy)}${plan.backBy ? `, back by ${formatNY(plan.backBy)}` : `, done about ${formatNY(plan.endTime)}`} (${plan.totalMin} min total, estimate)`);
  for (const leg of plan.legs) {
    if (leg.type === "transit") {
      console.log(`  ${formatNY(leg.startTime)}  RIDE ${leg.durationMin} min (est)  ${leg.from} -> ${leg.to}  [${leg.instruction}]`);
    } else {
      console.log(`  ${formatNY(leg.startTime)}  walk ${leg.durationMin} min  ${leg.from} -> ${leg.to}  [${leg.instruction}]`);
    }
  }
  for (const s of plan.stops) {
    console.log(`  ${formatNY(s.arriveAt)}-${formatNY(s.leaveAt)}  STOP (${s.need}): ${s.place.name}`);
  }
  for (const k of plan.skipped) console.log(`  SKIPPED ${k.need}: ${k.reason}`);
  for (const w of plan.warnings) console.log(`  warning: ${w}`);
}

const now = new Date();
const p = nyParts(now);
console.log(`Boston time now: ${formatNY(now)} (${p.dayKey}). Using 2:00 PM today for the samples.`);

const twoPm = todayAtNY("14:00", now);
const everything = ["grocery", "snack", "activity", "favorite"] as PlanInput["needs"];

show("Kenmore start, normal", { needs: everything, startTime: twoPm, loop: true });
show("Kenmore start, calm (shorter walks)", { needs: everything, startTime: twoPm, loop: true, mode: "calm" });
show("Late night (10:30 PM): most things closed", { needs: everything, startTime: todayAtNY("22:30", now), loop: false });
show("Downtown start (Boston Common), no loop", {
  needs: ["grocery", "snack", "activity"],
  startTime: twoPm,
  loop: false,
  start: { name: "Boston Common", lat: 42.355, lng: -71.0656 },
});
show("Boston Common, snack + activity, loop back", {
  needs: ["activity", "snack"],
  startTime: twoPm,
  loop: true,
  start: { name: "Boston Common", lat: 42.355, lng: -71.0656 },
});
show("Kenmore start, calm, loop (short walks)", {
  needs: ["grocery", "activity"],
  startTime: twoPm,
  loop: true,
  mode: "calm",
  start: KENMORE,
});
show("Boston Common, snack + grocery (should use the Orange Line)", {
  needs: ["snack", "grocery"],
  startTime: twoPm,
  loop: false,
  start: { name: "Boston Common", lat: 42.355, lng: -71.0656 },
});
console.log(`\nPlaces loaded: ${PLACES.length}. Default start: ${KENMORE.name}.`);

// Far-apart stops must visibly include a train, in BOTH modes.
let farTrips = 0;
let farWithoutTrain = 0;
const needSets: PlanInput["needs"][] = [
  ["grocery", "activity", "snack"],
  ["favorite", "activity", "grocery"],
  ["snack", "grocery"],
  ["activity", "favorite", "snack", "grocery"],
];
for (const start of START_POINTS) {
  for (const mode of ["normal", "calm"] as const) {
    for (const needs of needSets) {
      const plan = planRoute({ needs, startTime: twoPm, loop: true, mode, start }, PLACES);
      const points = [plan.start, ...plan.stops.map((s) => s.place), ...(plan.backBy ? [plan.start] : [])];
      for (let i = 1; i < points.length; i++) {
        if (walkMinutes(points[i - 1], points[i]) <= 25) continue; // not far apart
        farTrips++;
        // Is there a train leg arriving between these two points? (legs and stops are in time order)
        const t0 = i === 1 ? new Date(plan.leaveBy).getTime() : new Date(plan.stops[i - 2].leaveAt).getTime();
        const t1 = i - 1 < plan.stops.length ? new Date(plan.stops[i - 1].arriveAt).getTime() : new Date(plan.endTime).getTime();
        const hasTrain = plan.legs.some((l) => l.type === "transit" && new Date(l.startTime).getTime() >= t0 && new Date(l.startTime).getTime() <= t1);
        if (!hasTrain) {
          farWithoutTrain++;
          console.log(`  FAIL: ${mode} from ${start.name}: ${points[i - 1].name} -> ${points[i].name} is a long walk with no train`);
        }
      }
    }
  }
}
console.log(`\nFar-apart check: ${farTrips} long hops, ${farWithoutTrain} without a train ${farWithoutTrain === 0 ? "(OK)" : "(PROBLEM)"}`);

// Orange Line checks: stations, terminals, one change onto the Green Line, and a plan that rides it.
import { findRoute } from "../transit";
const orangeOnly = findRoute("place-bbsta", "place-haecl", "normal");
const orangeThenGreen = findRoute("place-bbsta", "place-pktrm", "normal");
console.log(`Orange Back Bay -> Haymarket: ${orangeOnly?.rides.map((r) => `${r.line.name} ${r.stops} stops toward ${r.toward.join("/")} (${r.platform})`).join(" + ")}`);
console.log(`Orange Back Bay -> Park Street: ${orangeThenGreen?.rides.map((r) => `${r.line.name} toward ${r.toward.join("/")}`).join(" + ")} (${orangeThenGreen?.changes} change)`);
const orangePlan = planRoute({ needs: ["snack", "grocery"], startTime: twoPm, loop: false, start: { name: "Boston Common", lat: 42.355, lng: -71.0656 } }, PLACES);
const usedOrange = orangePlan.legs.some((l) => l.type === "transit" && l.lineLabel === "Orange Line");
console.log(`Orange plan check: ${usedOrange ? "OK, a plan rides the Orange Line" : "PROBLEM, no Orange leg"}`);

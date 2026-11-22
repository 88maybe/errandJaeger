// Run with: npm run check:planner
// Prints a sample plan so you can see the planner work before any screen exists.
import { planRoute } from "./index";
import { KENMORE, PLACES } from "./places";
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
console.log(`\nPlaces loaded: ${PLACES.length}. Default start: ${KENMORE.name}.`);

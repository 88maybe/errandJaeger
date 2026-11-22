import type { Basis } from "@/lib/planner/types";

const LABEL: Record<Basis, string> = { live: "Live", scheduled: "Scheduled", estimate: "Estimate" };

// A small label saying where a time comes from: Live (MBTA predictions), Scheduled (timetable) or Estimate (our guess).
export default function TimeChip({ basis }: { basis: Basis }) {
  return <span className={`tchip tchip-${basis}`}>{LABEL[basis]}</span>;
}

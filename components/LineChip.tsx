import { chipLabel, familyOf, LINE_COLOUR } from "@/lib/transit/look";

// The ONE line chip used everywhere: "GL B", "RL", "OL", "BL" in the official MBTA colour.
export default function LineChip({ routeIds }: { routeIds: string[] }) {
  const family = familyOf(routeIds);
  return (
    <span className="line-chip" style={{ background: LINE_COLOUR[family] }} aria-label={family}>
      {chipLabel(routeIds)}
    </span>
  );
}

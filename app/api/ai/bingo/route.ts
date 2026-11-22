import { askGemini } from "@/lib/ai/gemini";
import { guard } from "@/lib/ai/guard";
import { validateBingoLabels } from "@/lib/ai/validate";

// Rewords bingo squares for real stops into friendly plain language. The real place name must stay in the text.
export async function POST(request: Request) {
  const body = await guard(request);
  if (body instanceof Response) return body;

  const stops = (Array.isArray(body.stops) ? body.stops : [])
    .slice(0, 8)
    .flatMap((s) =>
      s && typeof s.id === "string" && typeof s.place === "string" && typeof s.need === "string"
        ? [{ id: s.id.slice(0, 80), place: s.place.slice(0, 80), need: s.need.slice(0, 30) }]
        : [],
    );
  if (stops.length === 0) return Response.json({ ok: false, reason: "empty" }, { status: 400 });

  const system = [
    "You write short, friendly bingo square names for real places in a walking game. Plain, warm, easy to read.",
    'Reply with JSON only: {"labels": [{"id": string, "label": string}]}',
    "Each label: at most 7 words, starts with a verb (for example Visit, Grab, Pick up, Wander through). Keep the place name EXACTLY as given.",
    'Use the "need" to choose the verb ("grocery" -> pick up groceries, "snack" -> grab a snack, "activity" -> visit or explore, "favorite" -> revisit).',
    "Do not add facts, times, prices, directions, opening hours or other places. No exclamation marks.",
  ].join("\n");

  const result = await askGemini({ system, prompt: JSON.stringify({ stops }) });
  if (!result.ok) return Response.json({ ok: false, reason: result.reason });

  const labels = validateBingoLabels(result.json, stops);
  if (Object.keys(labels).length === 0) return Response.json({ ok: false, reason: "bad-output" });
  return Response.json({ ok: true, labels });
}

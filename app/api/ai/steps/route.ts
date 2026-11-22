import { askGemini } from "@/lib/ai/gemini";
import { guard } from "@/lib/ai/guard";
import { validateActions, type StepFacts } from "@/lib/ai/validate";

// Rewrites calm-mode steps as ONE simple action each. Places, numbers and directions must match the planner's text.
export async function POST(request: Request) {
  const body = await guard(request);
  if (body instanceof Response) return body;

  const items: StepFacts[] = (Array.isArray(body.items) ? body.items : [])
    .slice(0, 20)
    .flatMap((i) =>
      i && typeof i.index === "number" && (i.kind === "walk" || i.kind === "stop" || i.kind === "transit") && typeof i.place === "string" && typeof i.text === "string"
        ? [
            {
              index: i.index,
              kind: i.kind as StepFacts["kind"],
              place: i.place.slice(0, 80),
              text: i.text.slice(0, 400),
              keep: Array.isArray(i.keep) ? i.keep.filter((k: unknown): k is string => typeof k === "string").slice(0, 8).map((k: string) => k.slice(0, 60)) : undefined,
            },
          ]
        : [],
    );
  if (items.length === 0) return Response.json({ ok: false, reason: "empty" }, { status: 400 });

  const system = [
    "You rewrite walking-plan steps for someone who finds planning tiring. Each step becomes ONE short, calm instruction with a single action.",
    'Reply with JSON only: {"steps": [{"index": number, "action": string}]}',
    "Each action: at most 25 words, plain words, no jargon. Keep the place name, every number and the direction EXACTLY as in the source text.\nIf an item has a \"keep\" list, every string in it must appear word for word in your action (platform names, train terminals, stops).",
    "If the source says a time is an estimate, say \"(estimate)\" after that time.\nDo not add or change any time, number, place, direction or transit information. No exclamation marks.",
  ].join("\n");

  const result = await askGemini({ system, prompt: JSON.stringify({ steps: items }) });
  if (!result.ok) return Response.json({ ok: false, reason: result.reason });

  const actions = validateActions(result.json, items);
  if (Object.keys(actions).length === 0) return Response.json({ ok: false, reason: "bad-output" });
  return Response.json({ ok: true, actions });
}

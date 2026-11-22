import { OUTSIDE_HEADERS } from "../http";
// SERVER ONLY. Talks to the Gemini API. The key comes from GEMINI_API_KEY (never sent to the browser).
// Used only from files under app/api/. Never import this from a component.

const BASE = process.env.GEMINI_API_BASE ?? "https://generativelanguage.googleapis.com";
// A stable Flash-class model from Google's docs. We chose Flash-Lite because the tasks are tiny and it answered
// in under a second when tested, while gemini-3.8-flash returned 503 UNAVAILABLE and gemini-3.6-flash took ~5s.
// Override with GEMINI_MODEL (for example "gemini-3.6-flash") if you want a bigger model.
const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";

export type GeminiResult = { ok: true; json: unknown } | { ok: false; reason: string };

// Asks Gemini for a JSON answer. Never throws: any problem comes back as { ok: false, reason }.
export async function askGemini(args: { system: string; prompt: string; timeoutMs?: number }): Promise<GeminiResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, reason: "no-key" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), args.timeoutMs ?? 8000); // give up after 8 seconds

  try {
    const res = await fetch(`${BASE}/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { ...OUTSIDE_HEADERS, "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: args.system }] },
        contents: [{ role: "user", parts: [{ text: args.prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2, maxOutputTokens: 2048 },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      // Add Google's short error label (like UNAVAILABLE or NOT_FOUND) to help debugging. Never includes the key.
      const label = await res.json().then((d) => d?.error?.status, () => undefined);
      return { ok: false, reason: `http-${res.status}${typeof label === "string" ? `:${label}` : ""}` };
    }

    const data = await res.json();
    const parts: { text?: string }[] = data?.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((p) => p.text ?? "").join("").trim();
    if (!text) return { ok: false, reason: "empty" };

    // Some models wrap JSON in ```json fences even when asked not to.
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    return { ok: true, json: JSON.parse(cleaned) };
  } catch (error) {
    return { ok: false, reason: error instanceof Error && error.name === "AbortError" ? "timeout" : "network-or-json" };
  } finally {
    clearTimeout(timer);
  }
}

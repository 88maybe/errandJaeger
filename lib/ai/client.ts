// Browser side: calls our own API routes (never Gemini directly, so the key stays on the server).
// Every call has a timeout and returns null on ANY problem, so callers always fall back to non-AI behaviour.
import type { ParsedRequest, StepFacts } from "./validate";

async function post<T>(path: string, body: unknown, timeoutMs = 12000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await res.json();
    return res.ok && data?.ok ? (data as T) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function aiParse(text: string): Promise<ParsedRequest | null> {
  const data = await post<{ parsed: ParsedRequest }>("/api/ai/parse", { text });
  return data?.parsed ?? null;
}

export async function aiBingoLabels(
  stops: { id: string; place: string; need: string }[],
): Promise<Record<string, string> | null> {
  const data = await post<{ labels: Record<string, string> }>("/api/ai/bingo", { stops });
  return data?.labels ?? null;
}

export async function aiActions(items: StepFacts[]): Promise<Record<number, string> | null> {
  const data = await post<{ actions: Record<number, string> }>("/api/ai/steps", { items });
  return data?.actions ?? null;
}

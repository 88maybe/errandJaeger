// SERVER ONLY. Talks to the MBTA V3 API. The key (MBTA_API_KEY) is optional and never leaves the server.
// Every call has a timeout and a short cache, and returns null on any problem so the app can carry on.

const BASE = process.env.MBTA_API_BASE ?? "https://api-v3.mbta.com"; // overridable for tests
const cache = new Map<string, { at: number; value: unknown }>();

export const SCHEDULE_TTL_MS = 10 * 60_000; // timetables hardly change during the day
export const ALERT_TTL_MS = 2 * 60_000; // alerts change more often

export async function mbtaGet<T = any>(
  path: string,
  params: Record<string, string>,
  ttlMs: number,
  timeoutMs = 6000,
): Promise<T | null> {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const cacheKey = url.toString();

  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const key = process.env.MBTA_API_KEY;
    const res = await fetch(url, { headers: key ? { "x-api-key": key } : {}, signal: controller.signal, cache: "no-store" });
    if (!res.ok) return null;
    const value = (await res.json()) as T;
    cache.set(cacheKey, { at: Date.now(), value });
    if (cache.size > 300) cache.clear(); // keep memory small
    return value;
  } catch {
    return null; // timeout, network or bad JSON
  } finally {
    clearTimeout(timer);
  }
}

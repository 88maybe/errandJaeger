// SERVER ONLY. Shared checks for the AI API routes: size limit and a simple per-visitor rate limit,
// so a public deploy can't be used to burn the Gemini key. (Best effort: memory resets on cold starts.)

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
const hits = new Map<string, number[]>();

function tooMany(ip: string, max = MAX_PER_WINDOW, bucket = hits): boolean {
  const now = Date.now();
  const recent = (bucket.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  bucket.set(ip, recent);
  if (bucket.size > 5000) bucket.clear(); // keep memory small
  return recent.length > max;
}

// Map search and directions are cheap free services, but a directions screen asks several at once.
const MAX_GET_PER_WINDOW = 90;
const getHits = new Map<string, number[]>();

// For GET routes (no body): true when this visitor is asking too often.
export function rateLimited(request: Request): boolean {
  return tooMany(request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local", MAX_GET_PER_WINDOW, getHits);
}

// Returns the JSON body, or a ready-made error Response.
export async function guard(request: Request): Promise<Record<string, unknown> | Response> {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  if (tooMany(ip)) return Response.json({ ok: false, reason: "rate-limited" }, { status: 429 });

  const raw = await request.text();
  if (raw.length > 8000) return Response.json({ ok: false, reason: "too-big" }, { status: 413 });
  try {
    const body = JSON.parse(raw);
    if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    // fall through
  }
  return Response.json({ ok: false, reason: "bad-request" }, { status: 400 });
}

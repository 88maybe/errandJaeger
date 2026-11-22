import { rateLimited } from "@/lib/ai/guard";
import { db, dbConfigured } from "@/lib/db/server";
import { listOutings, saveOuting } from "@/lib/db/sql";
import type { Outing } from "@/lib/storage";

// Finished outings and stats in Postgres, by an anonymous device id (a random id made in the browser).
// No DATABASE_URL, or any database problem: { ok: false } and the browser keeps its own copy.
const DEVICE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY = 200_000;

const off = (reason: string, status = 200) => Response.json({ ok: false, reason }, { status });

function looksLikeOuting(o: unknown): o is Outing {
  const x = o as Outing;
  return (
    !!x &&
    typeof x.id === "string" &&
    x.id.length <= 40 &&
    typeof x.createdAt === "string" &&
    !Number.isNaN(Date.parse(x.createdAt)) &&
    (x.finishedAt === undefined || !Number.isNaN(Date.parse(x.finishedAt))) &&
    Array.isArray(x.card) &&
    Array.isArray(x.ticked) &&
    !!x.plan &&
    Array.isArray(x.plan.stops) &&
    Array.isArray(x.plan.legs)
  );
}

export async function GET(request: Request) {
  if (!dbConfigured()) return off("no-db");
  if (rateLimited(request)) return off("rate-limited", 429);
  const device = new URL(request.url).searchParams.get("device") ?? "";
  if (!DEVICE.test(device)) return off("bad-request", 400);
  const query = await db();
  if (!query) return off("db-unavailable");
  try {
    return Response.json({ ok: true, outings: await listOutings(query, device) });
  } catch {
    return off("db-error");
  }
}

export async function POST(request: Request) {
  if (!dbConfigured()) return off("no-db");
  if (rateLimited(request)) return off("rate-limited", 429);
  const raw = await request.text();
  if (raw.length > MAX_BODY) return off("too-big", 413);
  let body: { deviceId?: unknown; outing?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return off("bad-request", 400);
  }
  if (typeof body.deviceId !== "string" || !DEVICE.test(body.deviceId) || !looksLikeOuting(body.outing) || !body.outing.finishedAt) {
    return off("bad-request", 400);
  }
  const query = await db();
  if (!query) return off("db-unavailable");
  try {
    const stats = await saveOuting(query, body.deviceId, body.outing);
    return Response.json({ ok: true, stats });
  } catch {
    return off("db-error");
  }
}

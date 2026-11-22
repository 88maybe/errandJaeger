// Checks the database SQL (lib/db/sql.ts) against a real Postgres engine running in memory (PGlite).
// No server or DATABASE_URL needed. Run: npm run check:db
import { PGlite } from "@electric-sql/pglite";
import { createTables, listOutings, saveOuting, type Query } from "../lib/db/sql";
import type { Outing } from "../lib/storage";

async function main() {
  const pg = new PGlite();
  const query: Query = async (sql, params) => ({ rows: (await pg.query(sql, params as unknown[])).rows as Record<string, unknown>[] });
  await createTables(query);
  await createTables(query); // second run must be harmless

  const device = "8f14e45f-ceea-4e67-a3c1-1234567890ab";
  const now = new Date().toISOString();
  const outing = {
    id: "test1",
    createdAt: now,
    finishedAt: now,
    mode: "normal",
    card: [{ id: "stop-a", label: "Visit A", kind: "stop" }, { id: "extra-0", label: "Notice something green", kind: "extra" }],
    ticked: [0, 1],
    step: 0,
    plan: { start: { name: "S", lat: 42.35, lng: -71.06 }, leaveBy: now, backBy: null, endTime: now, totalMin: 20, stops: [{}], skipped: [], warnings: [],
      legs: [{ type: "walk", from: "S", to: "A", startTime: now, durationMin: 12, instruction: "" }] },
  } as unknown as Outing;

  const first = await saveOuting(query, device, outing);
  const again = await saveOuting(query, device, { ...outing, ticked: [0] }); // same id: replaced, not doubled
  const list = await listOutings(query, device);
  const other = await listOutings(query, "00000000-0000-4000-8000-000000000000");
  const stats = (await query("SELECT * FROM ej_stats WHERE device_id = $1", [device])).rows[0];

  const ok = first.outings === 1 && again.outings === 1 && list.length === 1 && list[0].ticked.length === 1 && other.length === 0 && stats?.walk_min === 12;
  console.log(`saved: ${list.length} outing, stats row: ${JSON.stringify(stats && { outings: stats.outings, places: stats.places, walk_min: stats.walk_min, streak: stats.streak })}`);
  console.log(`Database check: ${ok ? "OK" : "PROBLEM"}`);
  process.exit(ok ? 0 : 1);
}
main();

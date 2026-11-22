// SERVER ONLY. The SQL for saving outings and stats (Postgres, e.g. Tiger Data).
// Every function takes a `query` function, so the same code runs on the real database and in the test script.
import { computeStats, type Stats } from "../stats";
import type { Outing } from "../storage";

export type Query = (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;

// Created on first use. "IF NOT EXISTS" makes this safe to run again.
export async function createTables(query: Query): Promise<void> {
  await query(`CREATE TABLE IF NOT EXISTS ej_outings (
    device_id   TEXT        NOT NULL,
    outing_id   TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ,
    data        JSONB       NOT NULL,
    saved_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (device_id, outing_id)
  )`);
  await query(`CREATE TABLE IF NOT EXISTS ej_stats (
    device_id   TEXT        PRIMARY KEY,
    outings     INTEGER     NOT NULL,
    places      INTEGER     NOT NULL,
    walk_min    INTEGER     NOT NULL,
    streak      INTEGER     NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
}

export async function listOutings(query: Query, deviceId: string): Promise<Outing[]> {
  const { rows } = await query(`SELECT data FROM ej_outings WHERE device_id = $1 ORDER BY finished_at NULLS LAST, created_at LIMIT 500`, [deviceId]);
  return rows.map((r) => (typeof r.data === "string" ? JSON.parse(r.data) : r.data) as Outing);
}

// Saves (or replaces) one finished outing, then refreshes that device's stats row.
export async function saveOuting(query: Query, deviceId: string, outing: Outing): Promise<Stats> {
  await query(
    `INSERT INTO ej_outings (device_id, outing_id, created_at, finished_at, data)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     ON CONFLICT (device_id, outing_id) DO UPDATE SET finished_at = EXCLUDED.finished_at, data = EXCLUDED.data, saved_at = now()`,
    [deviceId, outing.id, outing.createdAt, outing.finishedAt ?? null, JSON.stringify(outing)],
  );
  const stats = computeStats(await listOutings(query, deviceId));
  await query(
    `INSERT INTO ej_stats (device_id, outings, places, walk_min, streak) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (device_id) DO UPDATE SET outings = EXCLUDED.outings, places = EXCLUDED.places,
       walk_min = EXCLUDED.walk_min, streak = EXCLUDED.streak, updated_at = now()`,
    [deviceId, stats.outings, stats.placesVisited, stats.minutesWalked, stats.streak],
  );
  return stats;
}

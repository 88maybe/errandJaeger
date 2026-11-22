// SERVER ONLY. Connects to Postgres when DATABASE_URL is set. The connection string never leaves the server.
// Any problem returns null, and the browser keeps using its own storage.
import { Pool } from "pg";
import { createTables, type Query } from "./sql";

let pool: Pool | null = null;
let tablesReady: Promise<void> | null = null;

export const dbConfigured = () => !!process.env.DATABASE_URL;

// SSL as standard Postgres tools read "sslmode": "require" = encrypted, without checking the certificate chain
// (hosted Postgres such as Tiger Data often uses its own certificate authority); "verify-ca"/"verify-full" check it.
function connectionConfig(url: string) {
  try {
    const u = new URL(url);
    const mode = u.searchParams.get("sslmode");
    u.searchParams.delete("sslmode");
    const ssl = mode === "disable" ? false : mode === "verify-ca" || mode === "verify-full" ? { rejectUnauthorized: true } : mode ? { rejectUnauthorized: false } : undefined;
    return { connectionString: u.toString(), ...(ssl === undefined ? {} : { ssl }) };
  } catch {
    return { connectionString: url };
  }
}

export async function db(): Promise<Query | null> {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  try {
    pool ??= new Pool({ ...connectionConfig(url), max: 3, connectionTimeoutMillis: 4000, idleTimeoutMillis: 10_000, statement_timeout: 5000 });
    const query: Query = (sql, params) => pool!.query(sql, params as unknown[]);
    tablesReady ??= createTables(query);
    await tablesReady;
    return query;
  } catch (e) {
    tablesReady = null; // try again next time
    // Log only the error code and a short reason, never the connection string.
    const err = e as { code?: string; message?: string };
    console.warn(`[db] not available: ${err.code ?? "error"} ${(err.message ?? "").replace(/postgres(ql)?:\/\/\S+/gi, "<url>").slice(0, 120)}`);
    return null;
  }
}

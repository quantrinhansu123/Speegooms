import pg from "pg";
import type { Env } from "../../config/env";

let singleton: { url: string; pool: pg.Pool } | null = null;

export function postgresSsl(env: Env): pg.ConnectionConfig["ssl"] {
  if (!env.DATABASE_SSL) return undefined;
  let host = "";
  try {
    host = new URL(env.DATABASE_URL ?? "").hostname;
  } catch {
    host = "";
  }
  if (host.endsWith(".supabase.co") || host.endsWith(".pooler.supabase.com")) {
    return { rejectUnauthorized: false };
  }
  return { rejectUnauthorized: true };
}

/** Một pool cho cả process. Mọi repository dùng lại instance này. */
export function getPostgresPool(env: Env): pg.Pool {
  if (!env.DATABASE_URL) throw new Error("Thiếu DATABASE_URL");
  if (singleton?.url === env.DATABASE_URL) return singleton.pool;
  const previous = singleton;
  singleton = null;
  if (previous) void previous.pool.end();
  const pool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    max: env.PG_POOL_MAX,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    statement_timeout: 8_000,
    query_timeout: 8_000,
    ssl: postgresSsl(env),
    application_name: "speego-api",
  });
  singleton = { url: env.DATABASE_URL, pool };
  return pool;
}

export async function closePostgresPool(): Promise<void> {
  const current = singleton;
  singleton = null;
  if (current) await current.pool.end();
}

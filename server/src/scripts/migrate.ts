import { readFile } from "node:fs/promises";
import pg from "pg";
import { config } from "dotenv";
import { postgresSsl } from "../adapters/postgres/pool";
import { loadEnv } from "../config/env";
import { logger } from "../lib/logger";

config({ path: new URL("../../.env", import.meta.url) });

const env = loadEnv();
if (env.DB_PROVIDER !== "postgres" || !env.DATABASE_URL) {
  throw new Error("Migrate cần DB_PROVIDER=postgres và DATABASE_URL");
}

const client = new pg.Client({
  connectionString: env.DATABASE_URL,
  ssl: postgresSsl(env),
  connectionTimeoutMillis: 20_000,
  statement_timeout: 120_000,
  application_name: "speego-migrate",
});

const files = ["001_users.sql", "002_authz.sql", "003_crm_message.sql", "004_crm_lead.sql", "005_lead_mess_unique.sql"];

await client.connect();
try {
  await client.query("create extension if not exists pgcrypto");
  for (const file of files) {
    const sql = await readFile(new URL(`../../db/migrations/${file}`, import.meta.url), "utf8");
    await client.query(sql);
    logger.info("migration applied", { file });
  }
} catch (err) {
  logger.error("migration failed", { err });
  process.exitCode = 1;
} finally {
  await client.end();
}

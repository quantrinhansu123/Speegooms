/// <reference path="./types/express.d.ts" />
import { existsSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import type { Express } from "express";
import { createApp } from "./app";
import { loadEnv } from "./config/env";
import { createContainer } from "./container";

const envFile = join(process.cwd(), "server", ".env");
if (existsSync(envFile)) config({ path: envFile });

let pending: Promise<Express> | null = null;

/** Một app Express cho mỗi instance. Không listen — Next.js nhận request. */
export function getApp(): Promise<Express> {
  if (!pending) {
    pending = boot().catch((error: unknown) => {
      pending = null;
      throw error;
    });
  }
  return pending;
}

async function boot(): Promise<Express> {
  const env = loadEnv();
  const container = await createContainer(env);
  return createApp(env, container);
}

import type { Express } from "express";
import { createApp } from "./app";
import { loadEnv } from "./config/env";
import { createContainer } from "./container";

export async function createVercelApp(app: Express): Promise<Express> {
  // Use deployment env directly; standalone dotenv loading stays in main.ts.
  const env = loadEnv();
  const container = await createContainer(env);
  return createApp(env, container, app);
}

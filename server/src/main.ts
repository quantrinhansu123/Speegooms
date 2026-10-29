import { config } from "dotenv";
import { createApp } from "./app";
import { loadEnv } from "./config/env";
import { createContainer } from "./container";
import { logger } from "./lib/logger";

config({ path: new URL("../.env", import.meta.url) });

const env = loadEnv();
const container = await createContainer(env);
const app = createApp(env, container);
const server = app.listen(env.PORT, env.HOST, () => {
  logger.info("api listening", { host: env.HOST, port: env.PORT, provider: env.DB_PROVIDER });
});

let closing = false;

async function shutdown(signal: string) {
  if (closing) return;
  closing = true;
  logger.info("shutting down", { signal });
  server.close(async () => {
    await container.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

server.on("error", (err) => {
  logger.error("server failed", { err });
  process.exit(1);
});

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("unhandledRejection", (err) => {
  logger.error("unhandledRejection", { err });
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  logger.error("uncaughtException", { err });
  process.exit(1);
});

import { config } from "dotenv";
import { loadEnv } from "../config/env";
import { logger } from "../lib/logger";
import { createRepositories } from "../repositories/create-repositories";
import { demoUsers } from "../seeds/demo-users";
import { seedDemoUsers } from "../seeds/seed-demo-users";
import { ScryptPasswordHasher } from "../services/password.service";

config({ path: new URL("../../.env", import.meta.url) });

const env = loadEnv();
if (!env.SEED_USER_PASSWORD) {
  throw new Error("Thiếu SEED_USER_PASSWORD");
}
if (env.NODE_ENV === "production" && env.SEED_USER_PASSWORD === "speego@demo") {
  throw new Error("Đổi SEED_USER_PASSWORD trước khi seed production");
}

const repositories = await createRepositories(env);
try {
  if (env.DB_PROVIDER === "memory") {
    logger.info("memory seeds when the api process starts");
  } else {
    await seedDemoUsers(repositories.users, new ScryptPasswordHasher(), env.SEED_USER_PASSWORD);
    logger.info("seeded users", { count: demoUsers.length, provider: env.DB_PROVIDER });
  }
} catch (err) {
  logger.error("seed failed", { err });
  process.exitCode = 1;
} finally {
  await repositories.close();
}

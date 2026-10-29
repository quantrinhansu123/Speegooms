import type { Env } from "../config/env";
import { MemorySessionRepository, MemoryUserRepository } from "../adapters/memory/memory.repository";
import { closePostgresPool, getPostgresPool } from "../adapters/postgres/pool";
import { PostgresSessionRepository, PostgresUserRepository } from "../adapters/postgres/postgres.repository";
import { createSupabaseAdmin } from "../adapters/supabase/client";
import { SupabaseSessionRepository, SupabaseUserRepository } from "../adapters/supabase/supabase.repository";
import type { SessionRepository } from "./session.repository";
import type { UserDirectory, UserRepository } from "./user.repository";
import { seedDemoUsers } from "../seeds/seed-demo-users";
import { ScryptPasswordHasher } from "../services/password.service";

export interface Repositories {
  users: UserRepository & UserDirectory;
  sessions: SessionRepository;
  close(): Promise<void>;
}

/**
 * Adapter factory. Đổi DB bằng DB_PROVIDER, không sửa service.
 * memory: chỉ local/test. postgres và supabase dùng chung schema server/db/migrations.
 */
export async function createRepositories(env: Env): Promise<Repositories> {
  switch (env.DB_PROVIDER) {
    case "memory": {
      if (!env.SEED_USER_PASSWORD) throw new Error("Thiếu SEED_USER_PASSWORD");
      const users = new MemoryUserRepository();
      await seedDemoUsers(users, new ScryptPasswordHasher(), env.SEED_USER_PASSWORD);
      return {
        users,
        sessions: new MemorySessionRepository(),
        async close() {},
      };
    }
    case "postgres": {
      const pool = getPostgresPool(env);
      return {
        users: new PostgresUserRepository(pool),
        sessions: new PostgresSessionRepository(pool),
        close: () => closePostgresPool(),
      };
    }
    case "supabase": {
      const client = createSupabaseAdmin(env);
      return {
        users: new SupabaseUserRepository(client),
        sessions: new SupabaseSessionRepository(client),
        async close() {},
      };
    }
  }
}

import { randomBytes } from "node:crypto";
import type { Role } from "@speego/shared";
import type pg from "pg";
import { InfrastructureError } from "../../lib/errors";
import { hashSessionId, isSessionId } from "../../lib/session-id";
import { toUserRecord, type UserRecord } from "../../models/user.model";
import type { SessionRepository } from "../../repositories/session.repository";
import type { UserDirectory, UserRepository } from "../../repositories/user.repository";

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  department: string;
  title: string;
  password_hash: string;
};

export class PostgresUserRepository implements UserRepository, UserDirectory {
  constructor(private readonly pool: pg.Pool) {}

  async findByEmail(email: string): Promise<UserRecord | null> {
    const result = await this.query<UserRow>(
      `select id, email, name, role, department, title, password_hash
       from users
       where email = $1`,
      [email.trim().toLowerCase()],
    );
    const row = result.rows[0];
    return row ? toUserRecord(row) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const result = await this.query<UserRow>(
      `select id, email, name, role, department, title, password_hash
       from users
       where id = $1`,
      [id],
    );
    const row = result.rows[0];
    return row ? toUserRecord(row) : null;
  }

  async upsert(user: UserRecord): Promise<void> {
    await this.query(
      `insert into users (id, email, name, role, department, title, password_hash)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (id) do update set
         email = excluded.email,
         name = excluded.name,
         role = excluded.role,
         department = excluded.department,
         title = excluded.title,
         password_hash = excluded.password_hash`,
      [user.id, user.email.toLowerCase(), user.name, user.role, user.department, user.title, user.passwordHash],
    );
  }

  async ping(): Promise<void> {
    await this.query("select 1 as ok", []);
  }

  async list(): Promise<UserRecord[]> {
    const result = await this.query<UserRow>(
      `select id, email, name, role, department, title, password_hash
       from users
       order by name`,
      [],
    );
    return result.rows.map((row) => toUserRecord(row));
  }

  async updateRole(id: string, role: Role): Promise<UserRecord | null> {
    const result = await this.query<UserRow>(
      `update users set role = $2
       where id = $1
       returning id, email, name, role, department, title, password_hash`,
      [id, role],
    );
    const row = result.rows[0];
    return row ? toUserRecord(row) : null;
  }

  private async query<T extends pg.QueryResultRow>(sql: string, params: readonly unknown[]): Promise<pg.QueryResult<T>> {
    try {
      return await this.pool.query<T>(sql, [...params]);
    } catch (cause) {
      throw new InfrastructureError("database query failed", { cause });
    }
  }
}

type SessionRow = { user_id: string; expires_at: Date | string };

export class PostgresSessionRepository implements SessionRepository {
  constructor(private readonly pool: pg.Pool) {}

  async create(input: { userId: string; expiresAt: Date }): Promise<string> {
    const id = randomBytes(32).toString("base64url");
    await this.query(
      `insert into sessions (id_hash, user_id, expires_at) values ($1, $2, $3)`,
      [hashSessionId(id), input.userId, input.expiresAt.toISOString()],
    );
    return id;
  }

  async findValid(sessionId: string): Promise<{ userId: string } | null> {
    if (!isSessionId(sessionId)) return null;
    const key = hashSessionId(sessionId);
    const result = await this.query<SessionRow>(
      `select user_id, expires_at from sessions where id_hash = $1`,
      [key],
    );
    const row = result.rows[0];
    if (!row) return null;
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      await this.query(`delete from sessions where id_hash = $1`, [key]);
      return null;
    }
    return { userId: row.user_id };
  }

  async revoke(sessionId: string): Promise<void> {
    if (!isSessionId(sessionId)) return;
    await this.query(`delete from sessions where id_hash = $1`, [hashSessionId(sessionId)]);
  }

  private async query<T extends pg.QueryResultRow>(sql: string, params: readonly unknown[]): Promise<pg.QueryResult<T>> {
    try {
      return await this.pool.query<T>(sql, [...params]);
    } catch (cause) {
      throw new InfrastructureError("database query failed", { cause });
    }
  }
}

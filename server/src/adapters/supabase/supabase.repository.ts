import { randomBytes } from "node:crypto";
import type { Role } from "@speego/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { InfrastructureError } from "../../lib/errors";
import { hashSessionId, isSessionId } from "../../lib/session-id";
import { toUserRecord, type UserRecord } from "../../models/user.model";
import type { SessionRepository } from "../../repositories/session.repository";
import type { UserDirectory, UserRepository } from "../../repositories/user.repository";

const USER_COLUMNS = "id, email, name, role, department, title, password_hash";

function fail(error: { message: string } | null): void {
  if (error) throw new InfrastructureError("database query failed", { cause: error });
}

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  department: string;
  title: string;
  password_hash: string;
};

export class SupabaseUserRepository implements UserRepository, UserDirectory {
  constructor(private readonly client: SupabaseClient) {}

  async findByEmail(email: string): Promise<UserRecord | null> {
    const { data, error } = await this.client
      .from("users")
      .select(USER_COLUMNS)
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();
    fail(error);
    return data ? toUserRecord(data as UserRow) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const { data, error } = await this.client.from("users").select(USER_COLUMNS).eq("id", id).maybeSingle();
    fail(error);
    return data ? toUserRecord(data as UserRow) : null;
  }

  async upsert(user: UserRecord): Promise<void> {
    const { error } = await this.client.from("users").upsert(
      {
        id: user.id,
        email: user.email.toLowerCase(),
        name: user.name,
        role: user.role,
        department: user.department,
        title: user.title,
        password_hash: user.passwordHash,
      },
      { onConflict: "id" },
    );
    fail(error);
  }

  async ping(): Promise<void> {
    const { error } = await this.client.from("users").select("id").limit(1);
    fail(error);
  }

  async list(): Promise<UserRecord[]> {
    const { data, error } = await this.client.from("users").select(USER_COLUMNS).order("name");
    fail(error);
    return (data as UserRow[]).map((row) => toUserRecord(row));
  }

  async updateRole(id: string, role: Role): Promise<UserRecord | null> {
    const { data, error } = await this.client
      .from("users")
      .update({ role })
      .eq("id", id)
      .select(USER_COLUMNS)
      .maybeSingle();
    fail(error);
    return data ? toUserRecord(data as UserRow) : null;
  }
}

export class SupabaseSessionRepository implements SessionRepository {
  constructor(private readonly client: SupabaseClient) {}

  async create(input: { userId: string; expiresAt: Date }): Promise<string> {
    const id = randomBytes(32).toString("base64url");
    const { error } = await this.client.from("sessions").insert({
      id_hash: hashSessionId(id),
      user_id: input.userId,
      expires_at: input.expiresAt.toISOString(),
    });
    fail(error);
    return id;
  }

  async findValid(sessionId: string): Promise<{ userId: string } | null> {
    if (!isSessionId(sessionId)) return null;
    const key = hashSessionId(sessionId);
    const { data, error } = await this.client
      .from("sessions")
      .select("user_id, expires_at")
      .eq("id_hash", key)
      .maybeSingle();
    fail(error);
    if (!data) return null;
    const row = data as { user_id: string; expires_at: string };
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      await this.revoke(sessionId);
      return null;
    }
    return { userId: row.user_id };
  }

  async revoke(sessionId: string): Promise<void> {
    if (!isSessionId(sessionId)) return;
    const { error } = await this.client.from("sessions").delete().eq("id_hash", hashSessionId(sessionId));
    fail(error);
  }
}

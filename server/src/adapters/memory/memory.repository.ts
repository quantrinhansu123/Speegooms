import { randomBytes } from "node:crypto";
import type { Role } from "@speego/shared";
import { hashSessionId, isSessionId } from "../../lib/session-id";
import type { UserRecord } from "../../models/user.model";
import type { SessionRepository } from "../../repositories/session.repository";
import type { UserDirectory, UserRepository } from "../../repositories/user.repository";

export class MemoryUserRepository implements UserRepository, UserDirectory {
  private readonly byEmail = new Map<string, UserRecord>();
  private readonly byId = new Map<string, UserRecord>();

  async upsert(user: UserRecord): Promise<void> {
    const record = { ...user, email: user.email.toLowerCase() };
    this.byEmail.set(record.email, record);
    this.byId.set(record.id, record);
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const found = this.byEmail.get(email.trim().toLowerCase());
    return found ? { ...found } : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const found = this.byId.get(id);
    return found ? { ...found } : null;
  }

  async ping(): Promise<void> {}

  async list(): Promise<UserRecord[]> {
    return [...this.byId.values()].map((user) => ({ ...user })).sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }

  async updateRole(id: string, role: Role): Promise<UserRecord | null> {
    const found = this.byId.get(id);
    if (!found) return null;
    const next = { ...found, role };
    this.byId.set(id, next);
    this.byEmail.set(next.email, next);
    return { ...next };
  }
}

export class MemorySessionRepository implements SessionRepository {
  private readonly rows = new Map<string, { userId: string; expiresAt: number }>();

  async create(input: { userId: string; expiresAt: Date }): Promise<string> {
    const id = randomBytes(32).toString("base64url");
    this.rows.set(hashSessionId(id), { userId: input.userId, expiresAt: input.expiresAt.getTime() });
    return id;
  }

  async findValid(sessionId: string): Promise<{ userId: string } | null> {
    if (!isSessionId(sessionId)) return null;
    const key = hashSessionId(sessionId);
    const row = this.rows.get(key);
    if (!row) return null;
    if (row.expiresAt <= Date.now()) {
      this.rows.delete(key);
      return null;
    }
    return { userId: row.userId };
  }

  async revoke(sessionId: string): Promise<void> {
    if (!isSessionId(sessionId)) return;
    this.rows.delete(hashSessionId(sessionId));
  }
}

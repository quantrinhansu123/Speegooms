import { randomUUID } from "node:crypto";
import { createUserSchema, updateUserSchema, type PublicUser, type Role } from "@speego/shared";
import { AppError } from "../lib/errors";
import { toPublicUser } from "../models/user.model";
import type { UserDirectory, UserRepository } from "../repositories/user.repository";
import type { PasswordHasher } from "./password.service";
import type { SessionRepository } from "../repositories/session.repository";

export class UserAdminService {
  constructor(
    private readonly users: UserDirectory & UserRepository,
    private readonly passwords: PasswordHasher,
    private readonly sessions: SessionRepository,
  ) {}

  async create(input: unknown): Promise<PublicUser> {
    const parsed = createUserSchema.safeParse(input);
    if (!parsed.success) throw new AppError(422, "VALIDATION_ERROR", "Dữ liệu không hợp lệ");
    const { password, ...profile } = parsed.data;
    const user = { ...profile, id: randomUUID(), passwordHash: await this.passwords.hash(password) };
    await this.users.create(user);
    return toPublicUser(user);
  }

  async update(actorId: string, targetId: string, input: unknown): Promise<PublicUser> {
    const parsed = updateUserSchema.safeParse(input);
    if (!parsed.success) throw new AppError(422, "VALIDATION_ERROR", "Dữ liệu không hợp lệ");
    const current = await this.users.findById(targetId);
    if (!current) throw new AppError(404, "NOT_FOUND", "Không tìm thấy tài khoản");
    if (actorId === targetId && parsed.data.role !== current.role) {
      throw new AppError(403, "FORBIDDEN", "Không đổi vai trò của chính mình");
    }
    const updated = await this.users.update(targetId, parsed.data);
    if (!updated) throw new AppError(404, "NOT_FOUND", "Không tìm thấy tài khoản");
    return toPublicUser(updated);
  }

  async delete(actorId: string, targetId: string): Promise<void> {
    if (actorId === targetId) throw new AppError(403, "FORBIDDEN", "Không xóa tài khoản của chính mình");
    if (!await this.users.delete(targetId)) throw new AppError(404, "NOT_FOUND", "Không tìm thấy tài khoản");
    await this.sessions.revokeForUser(targetId);
  }

  async list(): Promise<PublicUser[]> {
    const rows = await this.users.list();
    return rows.map((row) => toPublicUser(row));
  }

  async updateRole(actorId: string, targetId: string, role: Role): Promise<PublicUser> {
    if (actorId === targetId) {
      throw new AppError(403, "FORBIDDEN", "Không đổi vai trò của chính mình");
    }
    const updated = await this.users.updateRole(targetId, role);
    if (!updated) throw new AppError(404, "NOT_FOUND", "Không tìm thấy tài khoản");
    return toPublicUser(updated);
  }
}

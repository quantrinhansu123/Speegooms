import type { PublicUser, Role } from "@speego/shared";
import { AppError } from "../lib/errors";
import { toPublicUser } from "../models/user.model";
import type { UserDirectory } from "../repositories/user.repository";

export class UserAdminService {
  constructor(private readonly users: UserDirectory) {}

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

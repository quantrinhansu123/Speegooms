import type { Role, UpdateUserInput } from "@speego/shared";
import type { UserRecord } from "../models/user.model";

/** Cổng đọc user. Auth phụ thuộc interface này, không phụ thuộc Postgres hay Supabase. */
export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  ping(): Promise<void>;
}

/** Ghi tài khoản cho seed, quản trị và đổi mật khẩu cá nhân. */
export interface UserDirectory {
  create(user: UserRecord): Promise<void>;
  update(id: string, input: UpdateUserInput): Promise<UserRecord | null>;
  delete(id: string): Promise<boolean>;
  changePassword(id: string, currentHash: string, nextHash: string): Promise<boolean>;
  upsert(user: UserRecord): Promise<void>;
  list(): Promise<UserRecord[]>;
  updateRole(id: string, role: Role): Promise<UserRecord | null>;
}

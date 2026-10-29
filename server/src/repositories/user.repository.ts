import type { Role } from "@speego/shared";
import type { UserRecord } from "../models/user.model";

/** Cổng đọc user. Auth phụ thuộc interface này, không phụ thuộc Postgres hay Supabase. */
export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  ping(): Promise<void>;
}

/** Ghi user cho seed. Tách khỏi UserRepository để service đăng nhập không có quyền ghi. */
export interface UserDirectory {
  upsert(user: UserRecord): Promise<void>;
  list(): Promise<UserRecord[]>;
  updateRole(id: string, role: Role): Promise<UserRecord | null>;
}

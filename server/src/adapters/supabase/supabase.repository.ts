import { randomBytes } from "node:crypto";
import type { Role } from "@speego/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { InfrastructureError } from "../../lib/errors";
import { hashSessionId, isSessionId } from "../../lib/session-id";
import { toUserRecord, type UserRecord } from "../../models/user.model";
import type { SessionRepository } from "../../repositories/session.repository";
import type { UserDirectory, UserRepository } from "../../repositories/user.repository";

const USER_COLUMNS =
  "id:ma_nguoi_dung,email:thu_dien_tu,name:ho_ten,role:vai_tro,department:phong_ban,title:chuc_danh,password_hash:mat_khau_bam";

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
      .from("nguoi_dung")
      .select(USER_COLUMNS)
      .eq("thu_dien_tu", email.trim().toLowerCase())
      .maybeSingle();
    fail(error);
    return data ? toUserRecord(data as UserRow) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const { data, error } = await this.client
      .from("nguoi_dung")
      .select(USER_COLUMNS)
      .eq("ma_nguoi_dung", id)
      .maybeSingle();
    fail(error);
    return data ? toUserRecord(data as UserRow) : null;
  }

  async upsert(user: UserRecord): Promise<void> {
    const { error } = await this.client.from("nguoi_dung").upsert(
      {
        ma_nguoi_dung: user.id,
        thu_dien_tu: user.email.toLowerCase(),
        ho_ten: user.name,
        vai_tro: user.role,
        phong_ban: user.department,
        chuc_danh: user.title,
        mat_khau_bam: user.passwordHash,
      },
      { onConflict: "ma_nguoi_dung" },
    );
    fail(error);
  }

  async ping(): Promise<void> {
    const { error } = await this.client.from("nguoi_dung").select("ma_nguoi_dung").limit(1);
    fail(error);
  }

  async list(): Promise<UserRecord[]> {
    const { data, error } = await this.client.from("nguoi_dung").select(USER_COLUMNS).order("ho_ten");
    fail(error);
    return (data as UserRow[]).map((row) => toUserRecord(row));
  }

  async updateRole(id: string, role: Role): Promise<UserRecord | null> {
    const { data, error } = await this.client
      .from("nguoi_dung")
      .update({ vai_tro: role })
      .eq("ma_nguoi_dung", id)
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
    const { error } = await this.client.from("phien_dang_nhap").insert({
      bam_ma_phien: hashSessionId(id),
      ma_nguoi_dung: input.userId,
      het_han_luc: input.expiresAt.toISOString(),
    });
    fail(error);
    return id;
  }

  async findValid(sessionId: string): Promise<{ userId: string } | null> {
    if (!isSessionId(sessionId)) return null;
    const key = hashSessionId(sessionId);
    const { data, error } = await this.client
      .from("phien_dang_nhap")
      .select("user_id:ma_nguoi_dung,expires_at:het_han_luc")
      .eq("bam_ma_phien", key)
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
    const { error } = await this.client.from("phien_dang_nhap").delete().eq("bam_ma_phien", hashSessionId(sessionId));
    fail(error);
  }
}

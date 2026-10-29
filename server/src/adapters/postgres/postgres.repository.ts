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
      `select ma_nguoi_dung as id, thu_dien_tu as email, ho_ten as name, vai_tro as role,
              phong_ban as department, chuc_danh as title, mat_khau_bam as password_hash
       from nguoi_dung
       where thu_dien_tu = $1`,
      [email.trim().toLowerCase()],
    );
    const row = result.rows[0];
    return row ? toUserRecord(row) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const result = await this.query<UserRow>(
      `select ma_nguoi_dung as id, thu_dien_tu as email, ho_ten as name, vai_tro as role,
              phong_ban as department, chuc_danh as title, mat_khau_bam as password_hash
       from nguoi_dung
       where ma_nguoi_dung = $1`,
      [id],
    );
    const row = result.rows[0];
    return row ? toUserRecord(row) : null;
  }

  async upsert(user: UserRecord): Promise<void> {
    await this.query(
      `insert into nguoi_dung (ma_nguoi_dung, thu_dien_tu, ho_ten, vai_tro, phong_ban, chuc_danh, mat_khau_bam)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (ma_nguoi_dung) do update set
         thu_dien_tu = excluded.thu_dien_tu,
         ho_ten = excluded.ho_ten,
         vai_tro = excluded.vai_tro,
         phong_ban = excluded.phong_ban,
         chuc_danh = excluded.chuc_danh,
         mat_khau_bam = excluded.mat_khau_bam`,
      [user.id, user.email.toLowerCase(), user.name, user.role, user.department, user.title, user.passwordHash],
    );
  }

  async ping(): Promise<void> {
    await this.query("select 1 as ok", []);
  }

  async list(): Promise<UserRecord[]> {
    const result = await this.query<UserRow>(
      `select ma_nguoi_dung as id, thu_dien_tu as email, ho_ten as name, vai_tro as role,
              phong_ban as department, chuc_danh as title, mat_khau_bam as password_hash
       from nguoi_dung
       order by ho_ten`,
      [],
    );
    return result.rows.map((row) => toUserRecord(row));
  }

  async updateRole(id: string, role: Role): Promise<UserRecord | null> {
    const result = await this.query<UserRow>(
      `update nguoi_dung set vai_tro = $2
       where ma_nguoi_dung = $1
       returning ma_nguoi_dung as id, thu_dien_tu as email, ho_ten as name, vai_tro as role,
                 phong_ban as department, chuc_danh as title, mat_khau_bam as password_hash`,
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
      `insert into phien_dang_nhap (bam_ma_phien, ma_nguoi_dung, het_han_luc) values ($1, $2, $3)`,
      [hashSessionId(id), input.userId, input.expiresAt.toISOString()],
    );
    return id;
  }

  async findValid(sessionId: string): Promise<{ userId: string } | null> {
    if (!isSessionId(sessionId)) return null;
    const key = hashSessionId(sessionId);
    const result = await this.query<SessionRow>(
      `select ma_nguoi_dung as user_id, het_han_luc as expires_at
       from phien_dang_nhap where bam_ma_phien = $1`,
      [key],
    );
    const row = result.rows[0];
    if (!row) return null;
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      await this.query(`delete from phien_dang_nhap where bam_ma_phien = $1`, [key]);
      return null;
    }
    return { userId: row.user_id };
  }

  async revoke(sessionId: string): Promise<void> {
    if (!isSessionId(sessionId)) return;
    await this.query(`delete from phien_dang_nhap where bam_ma_phien = $1`, [hashSessionId(sessionId)]);
  }

  private async query<T extends pg.QueryResultRow>(sql: string, params: readonly unknown[]): Promise<pg.QueryResult<T>> {
    try {
      return await this.pool.query<T>(sql, [...params]);
    } catch (cause) {
      throw new InfrastructureError("database query failed", { cause });
    }
  }
}

import { saleTargetMetrics, targetRoles, type TargetDepartment, type TargetGrid, type TargetMember, type TargetMetric, type TargetPeriod } from "@speego/shared";
import type pg from "pg";

export class PostgresTargetsRepository {
  constructor(private readonly pool: pg.Pool) {}

  /** Chỉ tiêu có thể giao: Sale cố định, Marketing theo danh mục KPI đang sử dụng. */
  async metrics(department: TargetDepartment): Promise<TargetMetric[]> {
    if (department !== "marketing") return [...saleTargetMetrics];
    const result = await this.pool.query<{ code: string; name: string; unit: string }>(
      `select code, name, unit from app.kpi_definitions where department = 'marketing' and active order by team, code`,
    );
    return result.rows.map((row) => ({ ...row, kind: "count" as const }));
  }

  async members(department: TargetDepartment): Promise<TargetMember[]> {
    const result = await this.pool.query<TargetMember>(
      `select ma_nguoi_dung as id, ho_ten as name from public.nguoi_dung where vai_tro = any($1::text[]) order by ho_ten, ma_nguoi_dung`,
      [targetRoles[department]],
    );
    return result.rows;
  }

  async grid(department: TargetDepartment, period: TargetPeriod, start: string): Promise<TargetGrid> {
    const [members, metrics, stored] = await Promise.all([
      this.members(department),
      this.metrics(department),
      this.pool.query<{ user_id: string; code: string; value: number }>(
        `select user_id, code, value::float8 as value from app.kpi_targets where department = $1 and period = $2 and start_date = $3::date`,
        [department, period, start],
      ),
    ]);
    const values: TargetGrid["values"] = {};
    for (const row of stored.rows) (values[row.user_id] ??= {})[row.code] = row.value;
    return { members, metrics, values };
  }

  /** Lưu cả bảng trong một giao dịch; value null xóa ô. Người không thuộc nhóm hoặc chỉ tiêu lạ bị từ chối. */
  async set(department: TargetDepartment, period: TargetPeriod, start: string, rows: { userId: string; code: string; value: number | null }[], actorId: string) {
    const [members, metrics] = await Promise.all([this.members(department), this.metrics(department)]);
    const memberIds = new Set(members.map((member) => member.id));
    const codes = new Set(metrics.map((metric) => metric.code));
    const rateCodes = new Set(metrics.filter((metric) => metric.kind === "rate").map((metric) => metric.code));
    for (const row of rows) {
      if (!memberIds.has(row.userId)) throw new TargetInputError("Người nhận mục tiêu không thuộc nhóm đã chọn");
      if (!codes.has(row.code)) throw new TargetInputError(`Chỉ tiêu ${row.code} không áp dụng cho nhóm này`);
      if (row.value !== null && rateCodes.has(row.code) && row.value > 100) throw new TargetInputError("Chỉ tiêu tỷ lệ nhập theo thang 0–100");
    }
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      for (const row of rows) {
        if (row.value === null) {
          await client.query(`delete from app.kpi_targets where user_id = $1 and period = $2 and start_date = $3::date and code = $4`, [row.userId, period, start, row.code]);
        } else {
          await client.query(
            `insert into app.kpi_targets (department, user_id, period, start_date, code, value, updated_by)
             values ($1, $2, $3, $4::date, $5, $6, $7)
             on conflict (user_id, period, start_date, code) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()`,
            [department, row.userId, period, start, row.code, row.value, actorId],
          );
        }
      }
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  /** Mục tiêu cá nhân của một kỳ cho báo cáo Sale: userId → code → value. */
  async forReport(userIds: string[], period: TargetPeriod, start: string): Promise<TargetGrid["values"]> {
    if (!userIds.length) return {};
    const result = await this.pool.query<{ user_id: string; code: string; value: number }>(
      `select user_id, code, value::float8 as value from app.kpi_targets where user_id = any($1::text[]) and period = $2 and start_date = $3::date`,
      [userIds, period, start],
    );
    const values: TargetGrid["values"] = {};
    for (const row of result.rows) (values[row.user_id] ??= {})[row.code] = row.value;
    return values;
  }
}

export class TargetInputError extends Error {}

import type pg from "pg";
import type { CreateKpiInput, KpiDefinition, KpiDepartment, UpdateKpiInput } from "@speego/shared";

const columns = `id::text, department, team as "group", code, name, unit,
  target::float8 as target, period, active, version`;

export class PostgresKpiRepository {
  constructor(private readonly pool: pg.Pool) {}

  async list(departments: readonly KpiDepartment[]): Promise<KpiDefinition[]> {
    const result = await this.pool.query<KpiDefinition>(
      `select ${columns} from app.kpi_definitions where department = any($1::text[]) order by department, team, code`,
      [departments],
    );
    return result.rows;
  }

  async create(input: CreateKpiInput, actorId: string): Promise<KpiDefinition> {
    const result = await this.pool.query<KpiDefinition>(
      `insert into app.kpi_definitions (department, team, code, name, unit, target, period, active, updated_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning ${columns}`,
      [input.department, input.group, input.code, input.name, input.unit, input.target, input.period, input.active, actorId],
    );
    return result.rows[0]!;
  }

  /** Phòng ban cố định; khóa phiên bản để tránh ghi đè cấu hình người khác vừa sửa. */
  async update(id: string, input: UpdateKpiInput, actorId: string): Promise<KpiDefinition | null> {
    const result = await this.pool.query<KpiDefinition>(
      `update app.kpi_definitions set team=$3, code=$4, name=$5, unit=$6, target=$7,
         period=$8, active=$9, updated_by=$10, updated_at=now(), version=version+1
       where id=$1 and department=$2 and version=$11 returning ${columns}`,
      [id, input.department, input.group, input.code, input.name, input.unit, input.target, input.period, input.active, actorId, input.version],
    );
    return result.rows[0] ?? null;
  }
}

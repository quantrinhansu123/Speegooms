import { paginationSchema, type ListPage, type PageRequest } from "@speego/shared";
import type { Request } from "express";
import type pg from "pg";
import { AppError } from "./errors";

export function readPagination(req: Request): PageRequest {
  const parsed = paginationSchema.safeParse(req.query);
  if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Phân trang không hợp lệ");
  return parsed.data;
}

export function emptyPage<T>(request: PageRequest): ListPage<T> {
  return { rows: [], pagination: { page: 1, pages: 1, total: 0, pageSize: request.pageSize, summary: {} } };
}

type Database = { query<T extends pg.QueryResultRow>(sql: string, values: readonly unknown[]): Promise<{ rows: T[] }> };

/** SQL fragments come from repository code; all user values remain parameters. */
export async function queryPage<T extends pg.QueryResultRow>(
  db: Database, source: string, values: readonly unknown[], request: PageRequest,
  options: { orderBy: string; where?: string; summary?: string },
): Promise<ListPage<T>> {
  const start = values.length + 1;
  const result = await db.query<T & { __total: number; __page: number; __summary: Record<string, unknown>; __present: boolean | null }>(`
    with records as materialized (${source}),
    filtered as materialized (
      select *, row_number() over (order by ${options.orderBy}) as __position
      from records ${options.where ? `where ${options.where}` : ""}
    ), totals as (select count(*)::int as total from filtered),
    paging as (
      select total, coalesce(
        (select ((__position - 1) / $${start + 1}::int + 1)::int from filtered where id = $${start + 2}::text limit 1),
        least($${start}::int, greatest(1, ceil(total::numeric / $${start + 1})::int))) as page
      from totals
    )
    select data.*, p.total as __total, p.page as __page,
      ${options.summary ? `(select ${options.summary} from records)` : "'{}'::jsonb"} as __summary
    from paging p left join lateral (
      select *, true as __present from filtered order by __position
      limit $${start + 1} offset ((p.page - 1) * $${start + 1})
    ) data on true
    order by data.__position`, [...values, request.page, request.pageSize, request.focusId ?? null]);
  const first = result.rows[0];
  if (!first) return emptyPage(request);
  return {
    rows: result.rows.filter(row => row.__present).map((row) => {
      const { __total, __page, __summary, __present, __position, ...data } = row;
      void __total; void __page; void __summary; void __present; void __position;
      return data as unknown as T;
    }),
    pagination: { total: first.__total, page: first.__page, pages: Math.max(1, Math.ceil(first.__total / request.pageSize)), pageSize: request.pageSize, summary: first.__summary ?? {} },
  };
}

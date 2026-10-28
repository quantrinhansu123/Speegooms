"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { DataTable, type Column } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { NativeSelect } from "@/components/shared/form-fields";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { Input } from "@/components/ui/input";
import { usePagination } from "@/features/crm/hooks";
import { matchesQuery } from "@/lib/text";

export interface FilterDef<T> {
  id: string;
  label: string;
  options: { value: string; label: string }[];
  match: (row: T, value: string) => boolean;
  initial?: string;
  className?: string;
}

export interface ToggleDef<T> {
  id: string;
  label: string;
  match: (row: T) => boolean;
  initial?: boolean;
}

/**
 * Khung màn danh sách: tiêu đề, ô tìm kiếm, bộ lọc (select/checkbox), bảng, phân trang.
 * Dùng cho Fulfillment và Kế toán để giữ giao diện nhất quán với CRM và Vận hành.
 */
export function ListView<T>({
  title,
  description,
  actions,
  banner,
  summary,
  columns,
  rows,
  getRowId,
  searchLabel,
  searchPlaceholder,
  searchText,
  filters = [],
  toggles = [],
  sort,
  pageSize = 15,
  emptyTitle = "Không có bản ghi phù hợp",
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  banner?: React.ReactNode;
  summary?: React.ReactNode;
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  searchLabel: string;
  searchPlaceholder: string;
  searchText: (row: T) => (string | undefined)[];
  filters?: FilterDef<T>[];
  toggles?: ToggleDef<T>[];
  sort?: (a: T, b: T) => number;
  pageSize?: number;
  emptyTitle?: string;
}) {
  const [query, setQuery] = useState("");
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(filters.map((f) => [f.id, f.initial ?? ""])));
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(toggles.map((t) => [t.id, t.initial ?? false])));

  const filtered = useMemo(() => {
    const list = rows.filter(
      (r) =>
        matchesQuery(query, ...searchText(r)) &&
        filters.every((f) => !values[f.id] || f.match(r, values[f.id])) &&
        toggles.every((t) => !on[t.id] || t.match(r)),
    );
    return sort ? [...list].sort(sort) : list;
    // searchText/filters/toggles/sort là cấu hình ổn định của từng màn hình
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query, values, on]);
  const paging = usePagination(filtered, pageSize);

  return (
    <>
      {title && <PageHeader title={title} description={description} actions={actions} />}
      {banner}
      {summary}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 shadow-xs">
        <div className="relative min-w-60 flex-1">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label={searchLabel} placeholder={searchPlaceholder} value={query} onChange={(e) => setQuery(e.target.value)} className="h-9 pl-8" />
        </div>
        {filters.map((f) => (
          <NativeSelect key={f.id} aria-label={f.label} className={f.className ?? "w-48"} value={values[f.id]} onChange={(e) => setValues({ ...values, [f.id]: e.target.value })}>
            <option value="">{f.label}</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        ))}
        {toggles.map((t) => (
          <label key={t.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-[var(--brand-navy)]" checked={on[t.id]} onChange={(e) => setOn({ ...on, [t.id]: e.target.checked })} />
            {t.label}
          </label>
        ))}
      </div>
      <div className="space-y-4">
        <DataTable columns={columns} rows={paging.slice} getRowId={getRowId} empty={<EmptyState title={emptyTitle} />} />
        <Pagination page={paging.page} pages={paging.pages} total={paging.total} pageSize={paging.pageSize} onPageChange={paging.setPage} />
      </div>
    </>
  );
}

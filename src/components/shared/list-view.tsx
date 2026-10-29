"use client";

import { useId, useState } from "react";
import { Download, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { DataTable, type Column } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/csv";
import { date as dateSchema } from "@/services/backoffice/rules";
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
  exportFilename,
  headingLevel = 1,
  dateValue,
  dateLabel = "Ngày tạo",
  onRowClick,
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
  exportFilename?: string;
  headingLevel?: 1 | 2;
  dateValue?: (row: T) => string | undefined;
  dateLabel?: string;
  onRowClick?: (row: T) => void;
}) {
  const [query, setQuery] = useState("");
  const dateId = useId();
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(filters.map((f) => [f.id, f.initial ?? ""])));
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(toggles.map((t) => [t.id, t.initial ?? false])));
  const [sortKey, setSortKey] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const dateValid = (!from || dateSchema.safeParse(from).success) && (!to || dateSchema.safeParse(to).success) && (!from || !to || from <= to);
  const [exportMessage, setExportMessage] = useState<{ tone: "success" | "danger"; text: string }>();
  const exportColumns = columns.filter((c) => c.exportValue);
  const sortableColumns = columns.filter((c) => c.sortValue);

  const filtered = (() => {
    const list = rows.filter(
      (r) =>
        matchesQuery(query, ...searchText(r)) &&
        dateValid && (!from || (dateValue?.(r)?.slice(0, 10) ?? "") >= from) && (!to || (!!dateValue?.(r) && dateValue(r)!.slice(0, 10) <= to)) &&
        filters.every((f) => !values[f.id] || f.match(r, values[f.id])) &&
        toggles.every((t) => !on[t.id] || t.match(r)),
    );
    if (!sortKey) return sort ? list.sort(sort) : list;
    const [key, direction] = sortKey.split(":");
    const value = key === "__date" && dateValue ? (r: T) => dateValue(r) ?? "" : columns.find((c) => c.key === key)?.sortValue ?? ((r: T) => searchText(r).find(Boolean) ?? "");
    return list.sort((a, b) => {
      const x = value(a), y = value(b);
      const result = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "vi", { numeric: true });
      return direction === "desc" ? -result : result;
    });
  })();
  const paging = usePagination(filtered, pageSize);
  const activeCount = filters.filter((f) => values[f.id]).length + toggles.filter((t) => on[t.id]).length + Number(!!query.trim()) + Number(!!from || !!to);

  return (
    <>
      {title && <PageHeader title={title} description={description} actions={actions} headingLevel={headingLevel} />}
      {banner}
      {summary}
      <div className="mb-4 overflow-hidden rounded-xl border bg-card shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium"><SlidersHorizontal aria-hidden className="size-4 text-primary" /> Bộ lọc danh sách {activeCount > 0 && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{activeCount}</span>}</div>
          <Button type="button" variant="ghost" size="sm" disabled={!activeCount && !sortKey} onClick={() => { setQuery(""); setValues({}); setOn({}); setFrom(""); setTo(""); setSortKey(""); setExportMessage(undefined); paging.setPage(1); }}><RotateCcw aria-hidden /> Đặt lại</Button>
        </div>
        <div className="grid items-end gap-4 p-4 sm:grid-cols-2 xl:grid-cols-5">
        <Field label={searchLabel} htmlFor={`${dateId}-search`} className="sm:col-span-2">
        <div className="relative min-w-0">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id={`${dateId}-search`} placeholder={searchPlaceholder} value={query} onChange={(e) => { setQuery(e.target.value); paging.setPage(1); }} className="h-10 pl-8" />
        </div>
        </Field>
        {filters.map((f) => (
          <Field key={f.id} label={f.label} htmlFor={`${dateId}-${f.id}`} className={f.className}>
          <NativeSelect id={`${dateId}-${f.id}`} className="h-10 w-full" value={values[f.id] ?? ""} onChange={(e) => { setValues({ ...values, [f.id]: e.target.value }); paging.setPage(1); }}>
            <option value="">Tất cả</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
          </Field>
        ))}
        {dateValue && <><Field label={`${dateLabel} từ`} htmlFor={`${dateId}-from`}><Input id={`${dateId}-from`} className="h-10" type="date" value={from} onChange={(e) => { setFrom(e.target.value); paging.setPage(1); }} /></Field><Field label="Đến ngày" htmlFor={`${dateId}-to`}><Input id={`${dateId}-to`} className="h-10" type="date" value={to} onChange={(e) => { setTo(e.target.value); paging.setPage(1); }} /></Field></>}
        <Field label="Sắp xếp dữ liệu" htmlFor={`${dateId}-sort`}>
        <NativeSelect id={`${dateId}-sort`} className="h-10 w-full" value={sortKey} onChange={(e) => { setSortKey(e.target.value); paging.setPage(1); }}>
          <option value="">Thứ tự mặc định</option>
          {dateValue && <><option value="__date:desc">{dateLabel} mới nhất</option><option value="__date:asc">{dateLabel} cũ nhất</option></>}
          {(sortableColumns.length ? sortableColumns.map((c) => ({ key: c.key, header: c.header })) : [{ key: "search", header: "Mã / tên" }]).flatMap((c) => [<option key={`${c.key}:asc`} value={`${c.key}:asc`}>{c.header} ↑</option>, <option key={`${c.key}:desc`} value={`${c.key}:desc`}>{c.header} ↓</option>])}
        </NativeSelect>
        </Field>
        {exportFilename && exportColumns.length > 0 && <Button className="h-10" variant="outline" disabled={!filtered.length} onClick={() => {
          try {
            downloadCsv(exportFilename, exportColumns.map((c) => c.header), filtered.map((r) => exportColumns.map((c) => c.exportValue!(r))));
            setExportMessage({ tone: "success", text: `Đã tạo CSV với ${filtered.length} bản ghi theo bộ lọc và thứ tự hiện tại (toàn bộ trang).` });
          } catch { setExportMessage({ tone: "danger", text: "Không tạo được CSV. Vui lòng thử lại." }); }
        }}><Download aria-hidden /> Xuất CSV</Button>}
        {toggles.map((t) => (
          <label key={t.id} className="flex h-10 cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-[var(--brand-navy)]" checked={!!on[t.id]} onChange={(e) => { setOn({ ...on, [t.id]: e.target.checked }); paging.setPage(1); }} />
            {t.label}
          </label>
        ))}
        </div>
      </div>
      {!dateValid && <InlineAlert className="mb-4">Khoảng ngày không hợp lệ.</InlineAlert>}
      {exportMessage && <InlineAlert className="mb-4" tone={exportMessage.tone}>{exportMessage.text}</InlineAlert>}
      <div className="space-y-4">
        <DataTable columns={columns} rows={paging.slice} getRowId={getRowId} onRowClick={onRowClick} empty={<EmptyState title={emptyTitle} />} />
        <Pagination page={paging.page} pages={paging.pages} total={paging.total} pageSize={paging.pageSize} onPageChange={paging.setPage} />
      </div>
    </>
  );
}

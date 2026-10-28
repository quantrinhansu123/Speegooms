"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadCsv, type CsvValue } from "@/lib/csv";
import { date as dateSchema } from "@/services/backoffice/rules";
import { Field, InlineAlert, NativeSelect } from "./form-fields";

/** Bổ sung các điều khiển chung cho danh sách cũ mà giữ nguyên filter/kanban nghiệp vụ. */
export function useListTools<T>(items: T[], config: {
  filename: string; name: (row: T) => string;
  date?: (row: T) => string | undefined; dateLabel?: string;
  columns: { label: string; value: (row: T) => CsvValue }[];
}) {
  const id = useId();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState("");
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string }>();
  const valid = (!from || dateSchema.safeParse(from).success) && (!to || dateSchema.safeParse(to).success) && (!from || !to || from <= to);
  const rows = valid ? items.filter((row) => {
    const value = config.date?.(row)?.slice(0, 10);
    return (!from || (!!value && value >= from)) && (!to || (!!value && value <= to));
  }) : [];
  if (sort) rows.sort((a, b) => {
    const get = sort.startsWith("date") ? (row: T) => config.date?.(row) ?? "" : config.name;
    const comparison = get(a).localeCompare(get(b), "vi", { numeric: true });
    return sort.endsWith("desc") ? -comparison : comparison;
  });
  const toolbar = <div className="mb-4 space-y-3 rounded-xl border bg-card p-4">
    <div className="flex flex-wrap items-end gap-3">
      {config.date && <><Field label={`${config.dateLabel ?? "Ngày tạo"} từ`} htmlFor={`${id}-from`}><Input id={`${id}-from`} type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field><Field label="Đến ngày" htmlFor={`${id}-to`}><Input id={`${id}-to`} type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field></>}
      <Field label="Sắp xếp danh sách" htmlFor={`${id}-sort`}><NativeSelect id={`${id}-sort`} value={sort} onChange={(e) => setSort(e.target.value)}>
        <option value="">Thứ tự mặc định</option><option value="name-asc">Mã / tên A–Z</option><option value="name-desc">Mã / tên Z–A</option>{config.date && <><option value="date-desc">Ngày mới nhất</option><option value="date-asc">Ngày cũ nhất</option></>}
      </NativeSelect></Field>
      <Button variant="outline" disabled={!rows.length} onClick={() => {
        try { downloadCsv(config.filename, config.columns.map((c) => c.label), rows.map((row) => config.columns.map((c) => c.value(row)))); setMessage({ tone: "success", text: `Đã tạo CSV với ${rows.length} bản ghi theo bộ lọc và thứ tự hiện tại, gồm mọi trang.` }); }
        catch { setMessage({ tone: "danger", text: "Không tạo được CSV. Vui lòng thử lại." }); }
      }}>Xuất CSV</Button>
    </div>
    {!valid && <InlineAlert>Khoảng ngày không hợp lệ.</InlineAlert>}
    {message && <InlineAlert tone={message.tone}>{message.text}</InlineAlert>}
  </div>;
  return { rows, toolbar, filtering: !!from || !!to, resetKey: `${from}|${to}|${sort}` };
}

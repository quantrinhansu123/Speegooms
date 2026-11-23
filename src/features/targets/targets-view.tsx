"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, RefreshCw, Save, Split, Upload } from "lucide-react";
import {
  salesReportPeriods, salesReportToday, shiftSalesDay, targetDepartmentLabels, targetPeriodLabels, weekShareOfMonth,
  type TargetDepartment, type TargetGrid, type TargetPeriod,
} from "@speego/shared";
import { InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError, api } from "@/lib/api";
import { formatMoneyInput, parseMoneyInput } from "@/lib/format";
import { readTargetFile, downloadTargetTemplate, type TargetImportRow } from "./targets-excel";

const showDay = (date: string) => date.split("-").reverse().join("/");
const plain = (value: number | undefined) => (value === undefined ? "" : formatMoneyInput(String(Math.round(value * 100) / 100).replace(".", ",")));
const cellKey = (userId: string, code: string) => `${userId}|${code}`;
const fail = (error: unknown) => (error instanceof ApiError || error instanceof Error ? error.message : "Có lỗi xảy ra");

function weekChoices(today: string) {
  const thisWeek = salesReportPeriods("week", today).current.start;
  return Array.from({ length: 17 }, (_, index) => shiftSalesDay(thisWeek, (8 - index) * 7));
}

/** Bảng giao mục tiêu theo người cho một kỳ; dùng ở trang Giao mục tiêu và trong Cài đặt. */
export function TargetsEditor({ departments, fixedDepartment }: { departments: readonly TargetDepartment[]; fixedDepartment?: TargetDepartment }) {
  const [today] = useState(salesReportToday);
  const [department, setDepartment] = useState<TargetDepartment>(fixedDepartment ?? departments[0]!);
  const [period, setPeriod] = useState<TargetPeriod>("month");
  const [month, setMonth] = useState(today.slice(0, 7));
  const [week, setWeek] = useState(() => salesReportPeriods("week", today).current.start);
  const start = period === "month" ? `${month}-01` : week;
  // Dữ liệu gắn với khoá truy vấn: đổi kỳ/nhóm thì tự coi là đang tải, không cần xoá state trong effect.
  const [loaded, setLoaded] = useState<{ key: string; grid: TargetGrid } | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const query = `department=${department}&period=${period}&start=${start}`;
  const grid = loaded?.key === query ? loaded.grid : null;
  const setGrid = (next: TargetGrid) => setLoaded({ key: query, grid: next });

  useEffect(() => {
    if (period === "month" && !/^\d{4}-\d{2}$/.test(month)) return;
    const controller = new AbortController();
    api<TargetGrid>(`/api/targets?${query}`, { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) { setLoaded({ key: query, grid: data }); setEdits({}); setError(undefined); } })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(fail(cause)); });
    return () => controller.abort();
  }, [query, revision, period, month]);

  const shown = useCallback((userId: string, code: string) => edits[cellKey(userId, code)] ?? plain(grid?.values[userId]?.[code]), [edits, grid]);
  const dirty = Object.keys(edits).length;

  const buildRows = () => {
    const rows: { userId: string; code: string; value: number | null }[] = [];
    for (const [key, raw] of Object.entries(edits)) {
      const [userId, code] = key.split("|") as [string, string];
      const value = raw.trim() === "" ? null : parseMoneyInput(raw);
      if (raw.trim() !== "" && (value === null || !Number.isFinite(value))) throw new Error(`"${raw}" không phải số hợp lệ`);
      rows.push({ userId, code, value });
    }
    return rows;
  };

  const save = async () => {
    setBusy(true); setError(undefined); setNotice(undefined);
    try {
      const data = await api<TargetGrid>("/api/targets", { method: "PUT", body: JSON.stringify({ department, period, start, rows: buildRows() }) });
      setGrid(data); setEdits({}); setNotice("Đã lưu mục tiêu.");
    } catch (cause) { setError(fail(cause)); } finally { setBusy(false); }
  };

  /** Điền mục tiêu tuần từ mục tiêu tháng theo số ngày của tuần trong tháng; người dùng xem lại rồi bấm Lưu. */
  const splitFromMonth = async () => {
    if (!grid) return;
    setBusy(true); setError(undefined); setNotice(undefined);
    try {
      const months = [...new Set(Array.from({ length: 7 }, (_, index) => `${shiftSalesDay(week, index).slice(0, 7)}-01`))];
      const grids = Object.fromEntries(await Promise.all(months.map(async (monthStart) =>
        [monthStart, await api<TargetGrid>(`/api/targets?department=${department}&period=month&start=${monthStart}`)] as const)));
      const next: Record<string, string> = {};
      for (const member of grid.members) for (const metric of grid.metrics) {
        if (metric.kind === "rate") {
          const rate = grids[months[0]!]?.values[member.id]?.[metric.code];
          if (rate !== undefined) next[cellKey(member.id, metric.code)] = plain(rate);
          continue;
        }
        const share = weekShareOfMonth(week, (monthStart) => grids[monthStart]?.values[member.id]?.[metric.code]);
        if (share !== undefined) next[cellKey(member.id, metric.code)] = plain(share);
      }
      if (Object.keys(next).length === 0) setNotice("Chưa có mục tiêu tháng để chia.");
      else { setEdits((previous) => ({ ...previous, ...next })); setNotice("Đã điền từ mục tiêu tháng. Xem lại rồi bấm Lưu."); }
    } catch (cause) { setError(fail(cause)); } finally { setBusy(false); }
  };

  const template = async () => {
    if (!grid) return;
    try {
      await downloadTargetTemplate(department, { month: `${today.slice(0, 7)}-01`, week: salesReportPeriods("week", today).current.start }, grid.members, grid.metrics);
    } catch (cause) { setError(fail(cause)); }
  };

  const importFile = async (file: File) => {
    if (!grid) return;
    setBusy(true); setError(undefined); setNotice(undefined);
    try {
      const { rows, errors } = await readTargetFile(file, grid.members, grid.metrics);
      if (errors.length > 0) { setError(`File chưa hợp lệ, chưa lưu gì:\n${errors.slice(0, 12).join("\n")}${errors.length > 12 ? `\n… và ${errors.length - 12} lỗi nữa` : ""}`); return; }
      if (rows.length === 0) { setNotice("File không có ô mục tiêu nào để nhập."); return; }
      const groups = new Map<string, TargetImportRow[]>();
      for (const row of rows) groups.set(`${row.period}|${row.start}`, [...(groups.get(`${row.period}|${row.start}`) ?? []), row]);
      for (const [key, group] of groups) {
        const [groupPeriod, groupStart] = key.split("|");
        await api("/api/targets", { method: "PUT", body: JSON.stringify({ department, period: groupPeriod, start: groupStart, rows: group.map(({ userId, code, value }) => ({ userId, code, value })) }) });
      }
      setRevision((value) => value + 1);
      setNotice(`Đã nhập ${rows.length} ô mục tiêu cho ${groups.size} kỳ.`);
    } catch (cause) { setError(fail(cause)); } finally { setBusy(false); }
  };

  const periodText = useMemo(() => {
    if (period === "month") return `Tháng ${showDay(start).slice(3)}`;
    return `${showDay(start)} – ${showDay(shiftSalesDay(start, 6))}`;
  }, [period, start]);

  return (
    <div className="space-y-4">
      <Tabs value={period} onValueChange={(value) => { setPeriod(value as TargetPeriod); setEdits({}); setNotice(undefined); }}>
        <TabsList variant="line" aria-label="Loại mục tiêu" className="h-auto max-w-full flex-wrap justify-start gap-x-3 border-b">
          {(Object.keys(targetPeriodLabels) as TargetPeriod[]).map((key) => <TabsTrigger key={key} value={key} className="flex-none px-3 py-2">{targetPeriodLabels[key]}</TabsTrigger>)}
        </TabsList>
      </Tabs>
      <div className="flex flex-wrap items-center gap-2">
        {!fixedDepartment && departments.length > 1 && (
          <NativeSelect className="w-auto" aria-label="Nhóm nhận mục tiêu" value={department} onChange={(event) => { setDepartment(event.target.value as TargetDepartment); setEdits({}); }}>
            {departments.map((value) => <option key={value} value={value}>{targetDepartmentLabels[value]}</option>)}
          </NativeSelect>
        )}
        {period === "month" ? (
          <input aria-label="Tháng giao mục tiêu" type="month" min="1900-02" max="9998-12" value={month} className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
            onChange={(event) => { setMonth(event.target.value); setEdits({}); }} />
        ) : (
          <NativeSelect className="w-auto max-w-full" aria-label="Tuần giao mục tiêu" value={week} onChange={(event) => { setWeek(event.target.value); setEdits({}); }}>
            {weekChoices(today).map((value) => <option key={value} value={value}>{showDay(value)} – {showDay(shiftSalesDay(value, 6))}</option>)}
          </NativeSelect>
        )}
        <Button variant="ghost" size="icon" aria-label="Tải lại" title="Tải lại" disabled={busy} onClick={() => setRevision((value) => value + 1)}><RefreshCw aria-hidden /></Button>
        <span className="ml-auto flex flex-wrap items-center gap-2">
          {period === "week" && <Button variant="outline" disabled={busy || !grid} onClick={() => void splitFromMonth()}><Split aria-hidden /> Chia từ mục tiêu tháng</Button>}
          <Button variant="outline" disabled={!grid} onClick={() => void template()}><Download aria-hidden /> Tải mẫu</Button>
          <Button variant="outline" disabled={busy || !grid} onClick={() => fileInput.current?.click()}><Upload aria-hidden /> Import Excel</Button>
          <input ref={fileInput} aria-label="Import file mục tiêu" className="hidden" type="file" accept=".xlsx,.xls"
            onChange={(event) => { const file = event.target.files?.[0]; if (file) void importFile(file); event.target.value = ""; }} />
          <Button disabled={busy || dirty === 0} onClick={() => void save()}><Save aria-hidden /> Lưu{dirty > 0 ? ` (${dirty})` : ""}</Button>
        </span>
      </div>
      <p className="text-sm text-muted-foreground"><strong className="text-foreground">{periodText}</strong> · {targetDepartmentLabels[department]}. Ô trống là chưa giao; xóa số trong ô rồi Lưu để bỏ mục tiêu. Chỉ tiêu tỷ lệ nhập theo thang 0–100.</p>
      {error && <InlineAlert><span className="whitespace-pre-line">{error}</span></InlineAlert>}
      {notice && <p role="status" className="text-sm font-medium text-green-700 dark:text-green-400">{notice}</p>}
      {!grid && !error && <p role="status" className="py-5 text-sm text-muted-foreground">Đang tải…</p>}
      {grid && grid.members.length === 0 && <p className="py-5 text-sm text-muted-foreground">Chưa có nhân sự trong nhóm này.</p>}
      {grid && grid.members.length > 0 && grid.metrics.length === 0 && <p className="py-5 text-sm text-muted-foreground">Chưa có chỉ tiêu nào đang sử dụng. Thêm KPI trong Cài đặt.</p>}
      {grid && grid.members.length > 0 && grid.metrics.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <Table className="min-w-[640px]">
            <TableHeader className="bg-muted/50"><TableRow>
              <TableHead className="sticky left-0 z-10 bg-muted px-4">Nhân sự</TableHead>
              {grid.metrics.map((metric) => <TableHead key={metric.code} className="px-3 text-right">{metric.name}<span className="block text-xs font-normal text-muted-foreground">{metric.unit}</span></TableHead>)}
            </TableRow></TableHeader>
            <TableBody>{grid.members.map((member) => (
              <TableRow key={member.id}>
                <TableHead scope="row" className="sticky left-0 z-10 bg-card px-4 font-medium">{member.name}</TableHead>
                {grid.metrics.map((metric) => (
                  <TableCell key={metric.code} className="px-2 py-1.5">
                    <Input aria-label={`${member.name} · ${metric.name}`} inputMode="decimal" className="h-9 min-w-24 text-right tabular-nums" placeholder="—"
                      value={shown(member.id, metric.code)} disabled={busy}
                      onChange={(event) => setEdits((previous) => ({ ...previous, [cellKey(member.id, metric.code)]: formatMoneyInput(event.target.value) }))} />
                  </TableCell>
                ))}
              </TableRow>
            ))}</TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

/** Trang Giao mục tiêu: nhóm Sale (Sale VN/Global) và Marketing tùy quyền. */
export function TargetsView({ departments }: { departments: readonly TargetDepartment[] }) {
  return (
    <>
      <PageHeader title="Giao mục tiêu" description="Giao mục tiêu tháng, tuần cho từng người. Báo cáo Sale lấy mục tiêu từ đây." />
      <SectionCard title="Mục tiêu theo người" bodyClassName="min-w-0">
        {departments.length === 0
          ? <p className="py-5 text-sm text-muted-foreground">Bạn không có quyền giao mục tiêu.</p>
          : <TargetsEditor departments={departments} />}
      </SectionCard>
    </>
  );
}

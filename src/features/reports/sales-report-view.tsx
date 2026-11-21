"use client";

import { Fragment, useEffect, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, RefreshCw, Users } from "lucide-react";
import {
  canManageKpis, messageProcessingOptions, salesReportMetricCodes, salesReportPeriods, salesReportToday, shiftSalesDay,
  type SalesPerformanceReport, type SalesProcessingCounts, type SalesProcessingReport, type SalesReportMember,
} from "@speego/shared";
import { InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { usePolling } from "@/lib/use-polling";
import { useSession } from "@/features/auth/session-provider";
import { percentOf, performanceRows, salesMetrics } from "./sales-report-metrics";

const labels = { week: "Báo cáo tuần", month: "Báo cáo tháng", processing: "Xử lý khách hàng" } as const;
type View = keyof typeof labels;
type Report = SalesPerformanceReport | SalesProcessingReport;
const number = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });
const formatDate = (date: string) => date.split("-").reverse().join("/");
const formatValue = (value: number | null, suffix = "") => value === null ? "—" : `${number.format(value)}${suffix}`;
const tableNumber = "px-4 py-3 text-right tabular-nums";
const showPeriod = (start: string, end: string) => `${formatDate(start)} – ${formatDate(shiftSalesDay(end, -1))}`;

function PersonPicker({ members, selected, setSelected }: {
  members: SalesReportMember[];
  selected: string[] | null;
  setSelected: (ids: string[] | null) => void;
}) {
  const single = selected?.length === 1 ? members.find(({ id }) => id === selected[0])?.name : null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" disabled={members.length === 0} />}>
        <Users aria-hidden /> {single ?? (selected ? `${selected.length} người đã chọn` : `Tất cả (${members.length} người)`)} <ChevronDown aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-60">
        <DropdownMenuCheckboxItem checked={selected === null} onCheckedChange={() => setSelected(null)} className="font-semibold">Tất cả</DropdownMenuCheckboxItem>
        {members.map(({ id, name }) => (
          <DropdownMenuCheckboxItem key={id} checked={selected?.includes(id) ?? false} onCheckedChange={(checked) => {
            const next = checked ? [...(selected ?? []), id] : (selected ?? []).filter((item) => item !== id);
            setSelected(next.length ? next : null);
          }}>{name}</DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PeriodPicker({ view, date, today, setDate }: { view: "week" | "month"; date: string; today: string; setDate: (date: string) => void }) {
  const { current, previous } = salesReportPeriods(view, date);
  const thisWeek = salesReportPeriods("week", today).current.start;
  const weekOptions = view === "week" ? [...new Set([
    ...Array.from({ length: 13 }, (_, index) => shiftSalesDay(thisWeek, -index * 7)), current.start,
  ])].sort().reverse() : [];
  const periodName = view === "week" ? "tuần" : "tháng";
  return (
    <>
      <p className="text-sm text-muted-foreground">
        <strong className="text-foreground">{showPeriod(current.start, current.end)}</strong>
        {` · So với ${periodName} trước ${showPeriod(previous.start, previous.end)}`}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {view === "week" ? (
          <NativeSelect className="w-auto max-w-full" aria-label="Tuần báo cáo" value={current.start} onChange={(event) => setDate(event.target.value)}>
            {weekOptions.map((start) => <option key={start} value={start}>{start === thisWeek ? "Tuần này · " : ""}{showPeriod(start, shiftSalesDay(start, 7))}</option>)}
          </NativeSelect>
        ) : (
          <input aria-label="Tháng báo cáo" type="month" min="1900-02" max="9998-12" value={date.slice(0, 7)}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm" onChange={(event) => {
              if (/^\d{4}-\d{2}$/.test(event.target.value) && event.target.value >= "1900-02" && event.target.value <= "9998-12") setDate(`${event.target.value}-01`);
            }} />
        )}
        <Button variant="outline" disabled={previous.start < "1900-02-01"} onClick={() => setDate(previous.start)}><ChevronLeft aria-hidden /> {view === "week" ? "Tuần trước" : "Tháng trước"}</Button>
        <Button variant="outline" disabled={current.end > "9998-12-31"} onClick={() => setDate(current.end)}>{view === "week" ? "Tuần sau" : "Tháng sau"} <ChevronRight aria-hidden /></Button>
      </div>
    </>
  );
}

function PerformanceTable({ report, members, view, date }: { report: SalesPerformanceReport; members: SalesReportMember[]; view: "week" | "month"; date: string }) {
  const user = useSession();
  const { rows, missingRates } = performanceRows(report, members, salesReportPeriods(view, date).current);
  return (
    <>
      <div className="rounded-lg border">
        <Table className="min-w-[760px]">
          <TableHeader className="bg-muted/50"><TableRow>
            <TableHead className="px-4">Chỉ số</TableHead>
            { [`Mục tiêu ${view === "week" ? "tuần" : "tháng"}`, "Kết quả", "% hoàn thành", view === "week" ? "Tuần trước" : "Tháng trước", "Tăng giảm"].map((label) =>
              <TableHead className={tableNumber} key={label}>{label}</TableHead>) }
          </TableRow></TableHeader>
          <TableBody>{rows.map(({ key, label, kind, target, actual, previous, completion }) => {
            const delta = actual == null || previous == null ? null : actual - previous;
            const change = delta == null || previous == null ? null : percentOf(delta, previous);
            const suffix = kind === "rate" ? "%" : "";
            const deltaColor = delta == null || delta === 0 ? "text-muted-foreground" : delta > 0 ? "text-green-700 dark:text-green-400" : "text-danger";
            return (
              <TableRow key={key}>
                <TableHead scope="row" className="px-4 font-semibold">{label}</TableHead>
                <TableCell className={tableNumber}>{formatValue(target, suffix)}</TableCell>
                <TableCell className={tableNumber}>{formatValue(actual, suffix)}</TableCell>
                <TableCell className={`${tableNumber} font-semibold ${completion == null ? "text-muted-foreground" : completion >= 100 ? "text-green-700 dark:text-green-400" : completion >= 80 ? "text-info" : "text-danger"}`}>{formatValue(completion, "%")}</TableCell>
                <TableCell className={tableNumber}>{formatValue(previous, suffix)}</TableCell>
                <TableCell className={`${tableNumber} font-semibold ${deltaColor}`}>
                  {delta == null ? "—" : `${delta > 0 ? "▲ +" : delta < 0 ? "▼ " : ""}${formatValue(delta, kind === "rate" ? " điểm %" : "")}`}
                  {kind !== "rate" && change != null && delta !== 0 && ` (${change > 0 ? "+" : ""}${formatValue(change, "%")})`}
                </TableCell>
              </TableRow>
            );
          })}</TableBody>
        </Table>
      </div>
      {missingRates > 0 && <InlineAlert tone="warning">{missingRates} hợp đồng trong hai kỳ còn thiếu tỷ giá quy đổi. Doanh số của kỳ tương ứng chưa tính được.</InlineAlert>}
      <p className="text-xs text-muted-foreground">Tỷ lệ báo giá và chốt tính theo nhóm khách tiềm năng tạo trong kỳ, dựa trên báo giá và hợp đồng ký đến hết kỳ. Doanh số tính theo ngày ký hợp đồng.</p>
      {rows.some(({ target }) => target == null) && <p className="text-xs text-muted-foreground">Dấu — ở cột mục tiêu nghĩa là còn thiếu cấu hình KPI cho nhân sự đã chọn.</p>}
      {canManageKpis(user.role) && (
        <details className="text-xs text-muted-foreground">
          <summary className="w-fit cursor-pointer font-medium">Cách lấy mục tiêu từ Cài đặt KPI</summary>
          <p className="mt-2">Chỉ tiêu số lượng và doanh số được chia theo số Sale của từng phòng và số ngày trong kỳ. Chỉ tiêu tỷ lệ lấy trung bình theo nhân sự được chọn. Nhập chỉ tiêu tỷ lệ theo thang 0–100.</p>
          <ul className="mt-2 space-y-1">{salesMetrics.map(({ key, label }) => <li key={key}>{label} · <code>{salesReportMetricCodes[key]}</code></li>)}</ul>
        </details>
      )}
    </>
  );
}

function ProcessingTable({ report, members }: { report: SalesProcessingReport; members: SalesReportMember[] }) {
  const people = members.map(({ id, name }) => ({ id, name, counts: report.counts[id] ?? {} }));
  const combined: SalesProcessingCounts = {};
  for (const [code] of messageProcessingOptions) combined[code] = people.reduce((sum, person) => sum + (person.counts[code] ?? 0), 0);
  const groups = people.length > 1 ? [{ id: null, name: "Tổng nhóm", counts: combined }, ...people] : people;
  const columns = groups.map((group) => ({ ...group, total: Object.values(group.counts).reduce((a, b) => a + b, 0) }));
  return (
    <>
      <p className="text-sm text-muted-foreground">Theo trạng thái Mess hiện tại. Tỷ lệ mỗi mức tính trên toàn bộ Mess của từng Sale, gồm cả L0.</p>
      <div className="rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead rowSpan={2} scope="col" className="sticky left-0 z-10 bg-muted px-4">Trạng thái</TableHead>
              {columns.map(({ id, name }) => <TableHead key={id ?? "group"} scope="colgroup" colSpan={2} className="border-l px-4 text-center font-semibold">{name}</TableHead>)}
            </TableRow>
            <TableRow>{columns.map(({ id }) => <Fragment key={id ?? "group"}><TableHead className={`${tableNumber} border-l`}>Số lượng</TableHead><TableHead className={tableNumber}>Tỷ lệ</TableHead></Fragment>)}</TableRow>
          </TableHeader>
          <TableBody>
            {messageProcessingOptions.slice(1).map(([code, label]) => <TableRow key={code}>
              <TableHead scope="row" className="sticky left-0 z-10 bg-card px-4 font-medium">{label}</TableHead>
              {columns.map(({ id, counts, total }) => <Fragment key={id ?? "group"}>
                <TableCell className={`${tableNumber} border-l`}>{formatValue(counts[code] ?? 0)}</TableCell>
                <TableCell className={tableNumber}>{formatValue(percentOf(counts[code] ?? 0, total), "%")}</TableCell>
              </Fragment>)}
            </TableRow>)}
            <TableRow className="bg-muted/40 font-semibold">
              <TableHead scope="row" className="sticky left-0 z-10 bg-muted px-4 font-semibold">Tổng Mess (gồm L0)</TableHead>
              {columns.map(({ id, total }) => <Fragment key={id ?? "group"}><TableCell className={`${tableNumber} border-l`}>{formatValue(total)}</TableCell><TableCell className={tableNumber}>{total > 0 ? "100%" : "—"}</TableCell></Fragment>)}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </>
  );
}

export function SalesReportView() {
  const [today] = useState(salesReportToday);
  const [view, setView] = useState<View>("week");
  const [dates, setDates] = useState({ week: today, month: today });
  const [selected, setSelected] = useState<string[] | null>(null);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ path: string; data: Report | null; error?: string }>();
  const [members, setMembers] = useState<SalesReportMember[]>([]);
  const date = view === "processing" ? "" : dates[view];
  const path = `/api/sales-report?view=${view}${date ? `&date=${date}` : ""}`;
  const refresh = () => setRevision((value) => value + 1);
  usePolling(refresh);

  useEffect(() => {
    const controller = new AbortController();
    api<Report>(path, { signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted) {
        setResult({ path, data });
        setMembers(data.members);
      }
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setResult({ path, data: null, error: error instanceof Error ? error.message : "Không tải được báo cáo Sale" });
    });
    return () => controller.abort();
  }, [path, revision]);

  const current = result?.path === path ? result : undefined;
  const validIds = selected?.filter((id) => members.some((member) => member.id === id));
  const activeIds = validIds?.length ? validIds : null;
  const visible = members.filter(({ id }) => activeIds === null || activeIds.includes(id));

  return (
    <>
      <PageHeader title="Báo cáo Sale" />
      <Tabs value={view} onValueChange={(value) => setView(value as View)}>
        <TabsList variant="line" aria-label="Loại báo cáo" className="mb-3 h-auto max-w-full flex-wrap justify-start gap-x-3 border-b">
          {Object.entries(labels).map(([key, label]) => <TabsTrigger className="flex-none px-3 py-2" key={key} value={key}>{label}</TabsTrigger>)}
        </TabsList>
        <TabsContent value={view}>
          <SectionCard title={view === "processing" ? "Báo cáo xử lý khách hàng" : "Kết quả phòng Sale"} bodyClassName="min-w-0 space-y-4">
            {view !== "processing" && <PeriodPicker view={view} date={date} today={today} setDate={(value) => setDates((previous) => ({ ...previous, [view]: value }))} />}
            <div className="flex flex-wrap items-center gap-2">
              <PersonPicker members={members} selected={activeIds} setSelected={setSelected} />
              <Button variant="ghost" size="icon" aria-label="Tải lại báo cáo" title="Tải lại báo cáo" onClick={refresh}><RefreshCw aria-hidden /></Button>
            </div>
            {!current && <p role="status" className="py-5 text-sm text-muted-foreground">Đang tải báo cáo…</p>}
            {current?.error && <InlineAlert>{current.error}</InlineAlert>}
            {current?.data && (visible.length === 0 ? <p className="py-5 text-sm text-muted-foreground">Chưa có nhân sự Sale trong phạm vi báo cáo.</p>
              : "counts" in current.data ? <ProcessingTable report={current.data} members={visible} />
                : view !== "processing" && <PerformanceTable report={current.data} members={visible} view={view} date={date} />)}
          </SectionCard>
        </TabsContent>
      </Tabs>
    </>
  );
}

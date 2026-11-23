"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Target, Users } from "lucide-react";
import {
  manageableTargetDepartments, salesReportPeriods, salesReportToday, shiftSalesDay, targetPeriodLabels,
  type TargetPeriod,
} from "@speego/shared";
import { InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/features/auth/session-provider";
import { ApiError, api } from "@/lib/api";
import { targetReportRows, type TargetReportData } from "./target-report-model";


const number = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });
const showDay = (date: string) => date.split("-").reverse().join("/");

/** Mục tiêu tháng/tuần giao theo người (trang Giao mục tiêu) so với kết quả đã nghiệm thu trong kỳ. */
export function MarketingTargetReport() {
  const user = useSession();
  const [today] = useState(salesReportToday);
  const [period, setPeriod] = useState<TargetPeriod>("month");
  const [month, setMonth] = useState(today.slice(0, 7));
  const [week, setWeek] = useState(() => salesReportPeriods("week", today).current.start);
  const [loaded, setLoaded] = useState<{ key: string; data: TargetReportData } | null>(null);
  const [error, setError] = useState<string>();
  const [selected, setSelected] = useState<string[] | null>(null);
  const start = period === "month" ? `${month}-01` : week;
  const key = `${period}|${start}`;
  const report = loaded?.key === key ? loaded.data : null;
  const weeks = useMemo(() => {
    const thisWeek = salesReportPeriods("week", today).current.start;
    return Array.from({ length: 17 }, (_, index) => shiftSalesDay(thisWeek, (8 - index) * 7));
  }, [today]);

  useEffect(() => {
    if (period === "month" && !/^\d{4}-\d{2}$/.test(month)) return;
    const controller = new AbortController();
    api<TargetReportData>(`/api/marketing/target-report?period=${period}&start=${start}`, { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) { setLoaded({ key, data }); setError(undefined); } })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof ApiError || cause instanceof Error ? cause.message : "Không tải được báo cáo mục tiêu"); });
    return () => controller.abort();
  }, [period, start, month, key]);

  const rows = useMemo(() => (report ? targetReportRows(report, selected) : []), [report, selected]);
  const members = report?.members ?? [];
  const pickedLabel = selected === null ? `Tất cả (${members.length} người)` : selected.length === 1 ? members.find((member) => member.id === selected[0])?.name ?? "1 người" : `${selected.length} người đã chọn`;

  return (
    <SectionCard title="Mục tiêu so với kết quả" description="Mục tiêu tháng/tuần giao cho từng người, so với kết quả đã nghiệm thu Đạt trong kỳ." className="mb-5" bodyClassName="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={period} onValueChange={(value) => setPeriod(value as TargetPeriod)}>
          <TabsList variant="line" aria-label="Loại mục tiêu" className="h-auto gap-x-3">
            {(Object.keys(targetPeriodLabels) as TargetPeriod[]).map((key) => <TabsTrigger key={key} value={key} className="flex-none px-3 py-2">{targetPeriodLabels[key]}</TabsTrigger>)}
          </TabsList>
        </Tabs>
        {period === "month"
          ? <input aria-label="Tháng mục tiêu" type="month" min="1900-02" max="9998-12" value={month} onChange={(event) => setMonth(event.target.value)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm" />
          : <NativeSelect className="w-auto max-w-full" aria-label="Tuần mục tiêu" value={week} onChange={(event) => setWeek(event.target.value)}>
            {weeks.map((value) => <option key={value} value={value}>{showDay(value)} – {showDay(shiftSalesDay(value, 6))}</option>)}
          </NativeSelect>}
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" disabled={members.length === 0} />}>
            <Users aria-hidden /> {pickedLabel} <ChevronDown aria-hidden />
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
        {manageableTargetDepartments(user.role).includes("marketing") && (
          <Button nativeButton={false} variant="outline" className="ml-auto" render={<Link href="/giao-muc-tieu" />}><Target aria-hidden /> Giao mục tiêu</Button>
        )}
      </div>
      {error && <InlineAlert>{error}</InlineAlert>}
      {!report && !error && <p role="status" className="py-4 text-sm text-muted-foreground">Đang tải…</p>}
      {report && rows.length === 0 && <p className="py-4 text-sm text-muted-foreground">Kỳ này chưa giao mục tiêu và chưa có kết quả nghiệm thu nào.</p>}
      {report && rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <Table className="min-w-[640px]">
            <TableHeader className="bg-muted/50"><TableRow>
              <TableHead className="px-4">Nhân sự</TableHead><TableHead className="px-3">Chỉ tiêu KPI</TableHead>
              <TableHead className="px-3 text-right">Mục tiêu</TableHead><TableHead className="px-3 text-right">Kết quả đã nghiệm thu</TableHead><TableHead className="px-3 text-right">% hoàn thành</TableHead>
            </TableRow></TableHeader>
            <TableBody>{rows.map((row) => {
              const completion = row.completion;
              const color = completion === null ? "text-muted-foreground" : completion >= 100 ? "text-green-700 dark:text-green-400" : completion >= 80 ? "text-info" : "text-danger";
              const ceiling = row.metric.direction === "at-most";
              return (
                <TableRow key={row.key} className={row.key.startsWith("group|") ? "bg-muted/40 font-semibold" : undefined}>
                  <TableHead scope="row" className="px-4 font-medium">{row.member}</TableHead>
                  <TableCell className="px-3">{row.metric.name}<span className="block text-xs text-muted-foreground">{row.metric.unit}{ceiling ? " · tối đa" : ""}</span></TableCell>
                  <TableCell className="px-3 text-right tabular-nums">{row.target === undefined ? "—" : number.format(row.target)}</TableCell>
                  <TableCell className="px-3 text-right tabular-nums">{row.hasResult ? `${number.format(row.actual)}${ceiling ? " (TB)" : ""}` : "Chưa có"}<span className="block text-xs text-muted-foreground">{row.tasks} việc</span></TableCell>
                  <TableCell className={`px-3 text-right font-semibold tabular-nums ${color}`}>{completion === null ? "—" : `${number.format(completion)}%`}</TableCell>
                </TableRow>
              );
            })}</TableBody>
          </Table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Kết quả tính các việc không Hủy đã nghiệm thu Đạt, theo ngày hoàn thành (chưa có thì theo deadline). KPI tối thiểu cộng dồn; KPI tối đa lấy trung bình và % = mục tiêu / kết quả. Chọn từ 2 người trở lên sẽ có dòng Tổng nhóm.</p>
    </SectionCard>
  );
}

"use client";

import { useState } from "react";
import { Forbidden } from "@/components/shared/forbidden";
import { ErrorState } from "@/components/shared/error-state";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { ListView } from "@/components/shared/list-view";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { Input } from "@/components/ui/input";
import { CRM_TODAY } from "@/config/crm";
import { canViewReport, reportConfig, type ReportKey } from "@/config/reports";
import { canAccess } from "@/config/roles";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { date } from "@/services/backoffice/rules";
import { buildReport, type ReportRow } from "@/services/reports/rules";
import { usePlatformData } from "./use-platform-data";

export function ReportsView() {
  const platform = usePlatformData();
  const available = (Object.keys(reportConfig) as ReportKey[]).filter((key) => canViewReport(platform.user.role, key));
  const [requested, setRequested] = useState<ReportKey>(available[0] ?? "conversion");
  const [from, setFrom] = useState("2026-07-01");
  const [to, setTo] = useState(CRM_TODAY);
  if (!canAccess(platform.user.role, "/reports") || !available.length) return <Forbidden />;
  const key = available.includes(requested) ? requested : available[0];
  const valid = date.safeParse(from).success && date.safeParse(to).success && from <= to;
  const report = buildReport(platform, key, platform.user.role, from, to);
  if (platform.error) return <ErrorState message={platform.error} />;
  return <>
    <PageHeader title="Reports" description="Số liệu demo từ CRM, Vận hành, Fulfillment và Kế toán. Quyền xem và CSV giới hạn theo vai trò/tuyến hiện tại." />
    <div className="mb-4 grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2 xl:grid-cols-4">
      <Field label="Báo cáo" htmlFor="report-type" className="sm:col-span-2"><NativeSelect id="report-type" value={key} onChange={(e) => setRequested(e.target.value as ReportKey)}>{available.map((k) => <option key={k} value={k}>{reportConfig[k].label}</option>)}</NativeSelect></Field>
      <Field label="Từ ngày" htmlFor="report-from"><Input id="report-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
      <Field label="Đến ngày" htmlFor="report-to"><Input id="report-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
    </div>
    <p className="mb-4 text-sm text-muted-foreground">{reportConfig[key].description}</p>
    {!valid && <InlineAlert className="mb-4">Khoảng ngày không hợp lệ. Ngày kết thúc phải từ ngày bắt đầu trở đi.</InlineAlert>}
    {platform.ready ? <ListView<ReportRow> headingLevel={2} key={`${key}-${from}-${to}`} title={reportConfig[key].label} description={report.summary} rows={valid ? report.rows : []} getRowId={(r) => `${r.type ?? key}-${r.id}`} searchLabel="Tìm trong báo cáo" searchPlaceholder="Tìm mã, tên, trạng thái…" searchText={(r) => report.columns.map((c) => String(r[c.key] ?? ""))} exportFilename={`speego-${key}-${from}-${to}.csv`} columns={report.columns.map((c) => ({
      key: c.key, header: c.label, sortValue: (r) => r[c.key] ?? "", exportValue: (r) => r[c.key],
      align: c.kind && c.kind !== "date" ? "right" : "left",
      cell: (r) => {
        const value = r[c.key];
        if (value === undefined || value === "") return "—";
        if (c.kind === "date") return formatDate(String(value).slice(0, 10));
        if (c.kind === "percent") return `${formatNumber(Number(value))}%`;
        if (c.kind === "vnd" || c.kind === "usd") return formatMoney(Number(value), c.kind === "vnd" ? "VND" : "USD");
        return typeof value === "number" ? formatNumber(value) : value;
      },
    }))} /> : <TableSkeleton rows={8} columns={6} />}
  </>;
}

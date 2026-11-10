"use client";

import { useMemo, useState } from "react";
import { List } from "lucide-react";
import { proposalPeriodRange, type ProposalPeriod, type ProposalRecord } from "@speego/shared";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { matchesQuery } from "@/lib/text";
import { cn } from "@/lib/utils";
import { formatDateTime, statusMeta, today } from "./approval-shared";

const periods: [ProposalPeriod, string][] = [["week", "Tuần"], ["month", "Tháng"], ["year", "Năm"]];

type Row = { code: string; name: string; total: number; pending: number; approved: number; rejected: number; leaveApproved: number; leaveRejected: number; byTemplate: Map<string, number> };

/** Thống kê đề xuất theo mã nhân viên trong tuần / tháng / năm. */
export function ApprovalStats({ rows, search, onOpen }: { rows: ProposalRecord[]; search: string; onOpen: (id: string) => void }) {
  const [period, setPeriod] = useState<ProposalPeriod>("month");
  const [date, setDate] = useState(today());
  const [detail, setDetail] = useState<string | null>(null);

  const range = useMemo(() => proposalPeriodRange(period, new Date(`${date}T00:00:00`)), [period, date]);
  const inRange = useMemo(() => rows.filter((r) => { const t = new Date(r.createdAt); return t >= range.start && t < range.end; }), [rows, range]);

  const byEmployee = useMemo(() => {
    const map = new Map<string, Row>();
    for (const r of inRange) {
      const row = map.get(r.requesterId) ?? { code: r.requesterId, name: r.requesterName, total: 0, pending: 0, approved: 0, rejected: 0, leaveApproved: 0, leaveRejected: 0, byTemplate: new Map() };
      row.total += 1;
      if (r.status === "da-duyet") row.approved += 1; else if (r.status === "tu-choi") row.rejected += 1; else row.pending += 1;
      if (r.kind === "nghi-phep" && r.status === "da-duyet") row.leaveApproved += 1;
      if (r.kind === "nghi-phep" && r.status === "tu-choi") row.leaveRejected += 1;
      row.byTemplate.set(r.templateTitle, (row.byTemplate.get(r.templateTitle) ?? 0) + 1);
      map.set(r.requesterId, row);
    }
    return [...map.values()].sort((a, b) => b.total - a.total || a.code.localeCompare(b.code));
  }, [inRange]);

  const shown = byEmployee.filter((r) => matchesQuery(search, `${r.code} ${r.name}`));
  const sum = (key: "total" | "pending" | "approved" | "rejected" | "leaveApproved" | "leaveRejected") => String(byEmployee.reduce((n, r) => n + r[key], 0));
  const detailRows = detail ? inRange.filter((r) => r.requesterId === detail) : [];
  const detailEmployee = byEmployee.find((r) => r.code === detail);

  const label = period === "year" ? `Năm ${range.start.getFullYear()}` : period === "month"
    ? `Tháng ${String(range.start.getMonth() + 1).padStart(2, "0")}/${range.start.getFullYear()}`
    : `Tuần ${range.start.toLocaleDateString("vi-VN")} – ${new Date(range.end.getTime() - 86_400_000).toLocaleDateString("vi-VN")}`;

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Kỳ thống kê" className="inline-flex rounded-lg border p-0.5">
          {periods.map(([value, text]) => (
            <button key={value} type="button" aria-pressed={period === value} className={cn("rounded-md px-3 py-1 text-sm", period === value ? "bg-primary text-primary-foreground" : "hover:bg-muted")} onClick={() => setPeriod(value)}>{text}</button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          Chọn mốc
          <Input type="date" className="w-40" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <StatCard label="Nhân viên" value={String(byEmployee.length)} />
        <StatCard label="Tổng đề xuất" value={sum("total")} />
        <StatCard label="Chờ duyệt" value={sum("pending")} />
        <StatCard label="Đã duyệt" value={sum("approved")} />
        <StatCard label="Từ chối" value={sum("rejected")} />
        <StatCard label="Nghỉ phép được duyệt" value={sum("leaveApproved")} />
        <StatCard label="Nghỉ phép không duyệt" value={sum("leaveRejected")} />
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[56rem] text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              {["STT", "Mã NV", "Họ và tên", "Tổng", "Chờ duyệt", "Đã duyệt", "Từ chối", "Nghỉ phép duyệt", "Nghỉ phép không duyệt", "Theo loại mẫu", "Chi tiết"].map((h) => <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">Không có đề xuất trong kỳ này</td></tr>}
            {shown.map((r, i) => (
              <tr key={r.code} className="border-b last:border-0">
                <td className="px-3 py-2">{i + 1}</td>
                <td className="px-3 py-2 font-semibold">{r.code}</td>
                <td className="px-3 py-2">{r.name}</td>
                <td className="px-3 py-2">{r.total}</td><td className="px-3 py-2">{r.pending}</td><td className="px-3 py-2">{r.approved}</td><td className="px-3 py-2">{r.rejected}</td>
                <td className="px-3 py-2">{r.leaveApproved}</td><td className="px-3 py-2">{r.leaveRejected}</td>
                <td className="px-3 py-2"><div className="flex flex-wrap gap-1">{[...r.byTemplate].map(([name, n]) => <span key={name} className="rounded-full bg-muted px-2 py-0.5 text-xs">{name}: {n}</span>)}</div></td>
                <td className="px-3 py-2"><Button variant="outline" size="sm" onClick={() => setDetail(r.code)}><List /> Xem chi tiết</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail && (
        <Dialog open onOpenChange={(open) => { if (!open) setDetail(null); }}>
          <DialogContent className="flex max-h-[85dvh] flex-col sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{detailEmployee?.name ?? "—"}</DialogTitle>
              <p className="text-sm text-muted-foreground">Mã NV: {detail} • {label} • {detailRows.length} đề xuất</p>
            </DialogHeader>
            <div className="min-h-0 overflow-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-muted-foreground">{["STT", "Loại đề xuất", "Về việc", "Ngày giờ đề xuất", "Trạng thái"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
                <tbody>
                  {detailRows.map((r, i) => (
                    <tr key={r.id} className="cursor-pointer border-b last:border-0 hover:bg-muted/60" onClick={() => { setDetail(null); onOpen(r.id); }}>
                      <td className="px-3 py-2">{i + 1}</td><td className="px-3 py-2">{r.templateTitle}</td><td className="px-3 py-2">{r.subject}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(r.createdAt)}</td>
                      <td className="px-3 py-2"><StatusBadge tone={statusMeta[r.status].tone}>{statusMeta[r.status].label}</StatusBadge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

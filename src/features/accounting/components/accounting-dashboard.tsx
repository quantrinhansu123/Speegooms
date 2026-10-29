"use client";

import Link from "next/link";
import { CheckCircle2, Clock, FileSignature, HandCoins, Landmark, Scale } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { paymentPurposeLabels } from "@/config/accounting";
import { addDays } from "@/features/dashboard/metrics";
import { formatDate, formatVndCompact } from "@/lib/format";
import { buildLedger, buildPayables, buildReceivables } from "@/services/accounting/rules";
import { useAccounting } from "../hooks";
import { PaymentBadge, ThresholdNotice } from "./accounting-badges";

const mondayOf = (iso: string) => addDays(iso, -((new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7));

export function AccountingDashboard() {
  const { crm, ops, acc, today, staffName } = useAccounting();
  const customerOf = new Map(crm.customers.map((c) => [c.customerId, c.name]));

  const deposits = crm.contracts.filter((c) => c.status === "da-ky" && (c.deposit.status === "cho-ke-toan" || c.deposit.status === "khong-khop"));
  const depositTotal = deposits.reduce((a, c) => a + c.deposit.amount, 0);
  const awaiting = acc.payments.filter((p) => p.status === "cho-duyet");
  const toPay = acc.payments.filter((p) => p.status === "da-duyet");
  const sum = (arr: { amount: number }[]) => arr.reduce((a, x) => a + x.amount, 0);
  const receivable = buildReceivables(crm, ops, acc, today).reduce((a, r) => a + r.outstanding, 0);
  const payable = buildPayables(ops, acc).reduce((a, r) => a + r.outstanding, 0);

  const ledger = buildLedger(crm, ops, acc);
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(mondayOf(today), -7 * (7 - i)));
  const flow = weeks.map((w) => {
    const inRange = ledger.filter((e) => e.date >= w && e.date < addDays(w, 7));
    return { name: formatDate(w).slice(0, 5), thu: inRange.filter((e) => e.type === "thu").reduce((a, e) => a + e.amount, 0) / 1e6, chi: inRange.filter((e) => e.type === "chi").reduce((a, e) => a + e.amount, 0) / 1e6 };
  });
  const since = addDays(today, -29);
  const net = ledger.filter((e) => e.date >= since).reduce((a, e) => a + (e.type === "thu" ? e.amount : -e.amount), 0);

  return (
    <>
      <PageHeader title="Tài chính vận hành" description="Cọc cần đối soát, đề nghị chi, công nợ và dòng tiền ghi nhận. Chỉ ghi nhận trạng thái, không có thanh toán thật." />
      <ThresholdNotice compact />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Cọc cần đối soát" value={String(deposits.length)} icon={FileSignature} caption={`${formatVndCompact(depositTotal)} chờ Kế toán xác nhận`} href="/ke-toan/hop-dong" />
        <StatCard label="Đề nghị chi chờ duyệt" value={String(awaiting.length)} icon={Clock} caption={formatVndCompact(sum(awaiting))} href="/ke-toan/duyet-thanh-toan" />
        <StatCard label="Đã duyệt, chờ ghi nhận chi" value={String(toPay.length)} icon={HandCoins} caption={formatVndCompact(sum(toPay))} href="/ke-toan/de-nghi-thanh-toan" />
        <StatCard label="Công nợ phải thu" value={formatVndCompact(receivable)} icon={Landmark} caption="Giá trị hợp đồng chưa thu đủ" href="/ke-toan/cong-no" />
        <StatCard label="Công nợ phải trả còn lại" value={formatVndCompact(payable)} icon={Scale} caption="Đề nghị còn hiệu lực chưa chi" href="/ke-toan/cong-no" />
        <StatCard label="Thu trừ chi 30 ngày" value={formatVndCompact(net)} icon={CheckCircle2} caption="Theo sổ thu chi" href="/ke-toan/thu-chi" />
      </div>

      <SectionCard title="Thu và chi theo tuần" description="Triệu VND, 8 tuần gần nhất, theo sổ thu chi ghi nhận" className="mb-6">
        <div className="h-64" role="img" aria-label={`Thu và chi theo tuần: ${flow.map((f) => `${f.name} thu ${Math.round(f.thu)} chi ${Math.round(f.chi)}`).join("; ")} triệu đồng`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={flow} margin={{ left: -10 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
              <Tooltip cursor={{ fill: "var(--muted)" }} formatter={(v) => `${Math.round(Number(v))} tr`} labelFormatter={(l) => `Tuần bắt đầu ${l}`} contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 13 }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="thu" name="Thu" fill="var(--chart-1)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="chi" name="Chi" fill="var(--chart-2)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Cọc cần đối soát" description="Chỉ Kế toán xác nhận Đã cọc">
          {deposits.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Không còn cọc chờ đối soát" className="py-8" />
          ) : (
            <ul className="divide-y">
              {deposits.slice(0, 5).map((c) => (
                <li key={c.orderId} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <Link href={`/ke-toan/hop-dong/${c.orderId}`} className="font-mono text-xs font-medium text-primary hover:underline">{c.orderId}</Link>
                    <p className="truncate text-muted-foreground">{customerOf.get(c.customerId)} · {formatVndCompact(c.deposit.amount)}</p>
                  </div>
                  <StatusBadge tone={c.deposit.status === "khong-khop" ? "danger" : "warning"}>{c.deposit.status === "khong-khop" ? "Không khớp" : "Chờ đối soát"}</StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
        <SectionCard title="Đề nghị chi cần xử lý" description="Chờ duyệt hoặc chờ ghi nhận chi">
          {awaiting.length + toPay.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Không có đề nghị tồn đọng" className="py-8" />
          ) : (
            <ul className="divide-y">
              {[...awaiting, ...toPay].slice(0, 5).map((p) => (
                <li key={p.paymentId} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <Link href={`/ke-toan/de-nghi-thanh-toan/${p.paymentId}`} className="font-mono text-xs font-medium text-primary hover:underline">{p.paymentId}</Link>
                    <p className="truncate text-muted-foreground">{paymentPurposeLabels[p.purpose]} · {formatVndCompact(p.amount)} · nhập {staffName(p.requestedBy)}</p>
                  </div>
                  <PaymentBadge value={p.status} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </>
  );
}

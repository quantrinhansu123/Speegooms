"use client";

import Link from "next/link";
import { CheckCircle2, MessageCircleQuestion, PackageCheck, PackageOpen, Truck, Warehouse } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { inStockStatuses, packageStatusMeta } from "@/config/fulfillment";
import { addDays } from "@/features/dashboard/metrics";
import { formatDate, formatNumber } from "@/lib/format";
import { inboundDelayDays, isInStock, isInboundLate } from "@/services/fulfillment/rules";
import type { PackageStatus } from "@/types/fulfillment";
import { useFulfillment } from "../hooks";
import { InquiryBadge } from "./fulfillment-badges";

const mondayOf = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  const shift = (d.getUTCDay() + 6) % 7;
  return addDays(iso, -shift);
};

export function FulfillmentDashboard() {
  const { wh, crm, today } = useFulfillment();
  const customerOf = new Map(crm.contracts.map((c) => [c.orderId, crm.customers.find((x) => x.customerId === c.customerId)?.name ?? c.customerId]));

  const waiting = wh.receipts.filter((r) => r.status === "cho-nhap");
  const late = waiting.filter((r) => isInboundLate(r, today));
  const stock = wh.packages.filter(isInStock);
  const toPick = wh.outbounds.filter((o) => o.status === "cho-pick" || o.status === "dang-pick").length;
  const toPack = wh.outbounds.filter((o) => o.status === "da-pick").length;
  const delivering = wh.deliveries.filter((d) => d.status === "dang-giao" || d.status === "giao-that-bai").length;
  const openInquiries = wh.inquiries.filter((i) => i.status !== "da-tra-loi");

  const byStatus = inStockStatuses.map((s) => ({ name: packageStatusMeta[s as PackageStatus].label, kien: stock.filter((p) => p.status === s).length }));
  const weeks = Array.from({ length: 6 }, (_, i) => addDays(mondayOf(today), -7 * (5 - i)));
  const delivered = weeks.map((w) => ({ name: formatDate(w).slice(0, 5), don: wh.deliveries.filter((d) => d.status === "da-giao" && d.deliveredAt && d.deliveredAt >= w && d.deliveredAt < addDays(w, 7)).length }));
  const chartTotal = delivered.reduce((a, b) => a + b.don, 0);

  return (
    <>
      <PageHeader title="Fulfillment – Kho và giao nhận" description="Theo dõi hàng về kho, tồn kho, pick/pack, giao chặng cuối và yêu cầu hỏi tình trạng từ Sale." />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Hàng chờ nhập kho" value={formatNumber(waiting.length)} icon={PackageOpen} caption={late.length ? `${late.length} phiếu quá hạn nhập kho` : "Không có phiếu quá hạn"} href="/fulfillment/nhap-kho" />
        <StatCard label="Kiện đang tồn kho" value={formatNumber(stock.length)} icon={Warehouse} caption={`${formatNumber(stock.reduce((a, p) => a + p.quantity, 0))} sản phẩm`} href="/fulfillment/ton-kho" />
        <StatCard label="Lệnh chờ pick" value={formatNumber(toPick)} icon={PackageCheck} caption="Chờ hoặc đang pick" href="/fulfillment/pick-pack" />
        <StatCard label="Chờ đóng gói" value={formatNumber(toPack)} icon={CheckCircle2} caption="Đã pick xong" href="/fulfillment/pick-pack" />
        <StatCard label="Đang giao chặng cuối" value={formatNumber(delivering)} icon={Truck} caption="Chờ xác nhận POD hoặc giao lại" href="/fulfillment/giao-hang" />
        <StatCard label="Hỏi tình trạng chưa trả lời" value={formatNumber(openInquiries.length)} icon={MessageCircleQuestion} caption="Từ Sale" href="/fulfillment/hoi-tinh-trang" />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <SectionCard title="Kiện tồn kho theo trạng thái" description="Kiện còn nằm trong kho, chưa xuất">
          {stock.length === 0 ? (
            <EmptyState title="Kho đang trống" className="py-10" />
          ) : (
            <div className="h-60" role="img" aria-label={`Kiện tồn kho: ${byStatus.map((b) => `${b.name} ${b.kien}`).join(", ")}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byStatus} margin={{ left: -20 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                  <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 13 }} />
                  <Bar dataKey="kien" name="Số kiện" fill="var(--chart-1)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>
        <SectionCard title="Đơn đã giao theo tuần" description="Số lần giao có POD trong 6 tuần gần nhất">
          {chartTotal === 0 ? (
            <EmptyState title="Chưa có giao hàng trong kỳ" className="py-10" />
          ) : (
            <div className="h-60" role="img" aria-label={`Đơn đã giao theo tuần: ${delivered.map((b) => `${b.name} ${b.don}`).join(", ")}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={delivered} margin={{ left: -20 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                  <Tooltip cursor={{ fill: "var(--muted)" }} labelFormatter={(l) => `Tuần bắt đầu ${l}`} contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 13 }} />
                  <Bar dataKey="don" name="Đã giao" fill="var(--chart-2)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Hàng đã về, chưa nhập kho" description="Phiếu chờ nhập, lâu nhất lên đầu">
          {waiting.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Không có hàng chờ nhập" className="py-8" />
          ) : (
            <ul className="divide-y">
              {[...waiting].sort((a, b) => a.arrivedOn.localeCompare(b.arrivedOn)).slice(0, 5).map((r) => (
                <li key={r.receiptId} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <Link href="/fulfillment/nhap-kho" className="font-mono text-xs font-medium text-primary hover:underline">{r.receiptId}</Link>
                    <p className="truncate text-muted-foreground">{customerOf.get(r.orderId)} · {r.orderId}</p>
                  </div>
                  <StatusBadge tone={isInboundLate(r, today) ? "danger" : "warning"}>Về {inboundDelayDays(r, today)} ngày</StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
        <SectionCard title="Yêu cầu hỏi tình trạng chưa trả lời" description="Sale đang chờ phản hồi">
          {openInquiries.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Đã trả lời hết" className="py-8" />
          ) : (
            <ul className="divide-y">
              {openInquiries.slice(0, 5).map((q) => (
                <li key={q.inquiryId} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <Link href="/fulfillment/hoi-tinh-trang" className="font-mono text-xs font-medium text-primary hover:underline">{q.inquiryId}</Link>
                    <p className="truncate text-muted-foreground">{q.question}</p>
                  </div>
                  <InquiryBadge value={q.status} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </>
  );
}

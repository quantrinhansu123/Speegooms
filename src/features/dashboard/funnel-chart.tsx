"use client";

import { ArrowText } from "@/components/shared/arrow-text";

import { ArrowRight } from "lucide-react";
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionCard } from "@/components/shared/section-card";
import { formatNumber } from "@/lib/format";
import type { DashboardMetrics } from "./metrics";

const colors = ["var(--chart-1)", "var(--chart-1)", "var(--chart-2)"];

export function FunnelChart({ funnel }: { funnel: DashboardMetrics["funnel"] }) {
  const data = [
    { stage: "Lead", count: funnel.leads },
    { stage: "RFQ", count: funnel.rfqs },
    { stage: "Đơn hàng", count: funnel.orders },
  ];
  const summary = `Phễu chuyển đổi: ${funnel.leads} lead, ${funnel.rfqs} RFQ, ${funnel.orders} đơn hàng. Lead sang RFQ ${funnel.leadToRfq}%, RFQ sang đơn ${funnel.rfqToOrder}%.`;

  return (
    <SectionCard title="Chuyển đổi Lead → RFQ → Đơn hàng" description="Số bản ghi tạo trong khoảng thời gian đã chọn">
      {funnel.leads === 0 ? (
        <EmptyState title="Chưa có dữ liệu" description="Không có lead nào trong khoảng thời gian và phòng ban đã chọn." />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-md bg-accent px-2.5 py-1 font-medium text-primary tabular">Lead <ArrowText>{"→"}</ArrowText> RFQ {funnel.leadToRfq}%</span>
            <ArrowRight aria-hidden className="size-4 text-muted-foreground" />
            <span className="rounded-md bg-accent px-2.5 py-1 font-medium text-primary tabular">RFQ <ArrowText>{"→"}</ArrowText> Đơn {funnel.rfqToOrder}%</span>
          </div>
          <div className="h-56" role="img" aria-label={summary}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ left: 8, right: 48 }} barSize={30}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="stage"
                  width={84}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--foreground)", fontSize: 13, fontWeight: 500 }}
                />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} isAnimationActive={false}>
                  {data.map((_, i) => (
                    <Cell key={i} fill={colors[i]} fillOpacity={i === 1 ? 0.7 : 1} />
                  ))}
                  <LabelList
                    dataKey="count"
                    position="right"
                    formatter={(v: unknown) => formatNumber(Number(v))}
                    style={{ fill: "var(--foreground)", fontSize: 13, fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </SectionCard>
  );
}

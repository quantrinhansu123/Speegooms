"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionCard } from "@/components/shared/section-card";
import type { DashboardMetrics } from "./metrics";

export function RouteChart({ series, totals }: { series: DashboardMetrics["routeSeries"]; totals: DashboardMetrics["routeTotals"] }) {
  const total = totals.vn + totals.global;
  const summary = `Đơn hàng theo tuyến: ${totals.vn} đơn Việt Nam, ${totals.global} đơn Global.`;
  return (
    <SectionCard
      title="Đơn hàng theo tuyến"
      description={total ? `${totals.vn} đơn Việt Nam · ${totals.global} đơn Global, gom theo tuần` : "Số đơn mới theo tuần"}
    >
      {total === 0 ? (
        <EmptyState title="Chưa có đơn hàng" description="Không có đơn nào trong khoảng thời gian và phòng ban đã chọn." />
      ) : (
        <div className="h-64" role="img" aria-label={summary}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ left: -20, top: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
              <Tooltip
                cursor={{ fill: "var(--muted)" }}
                labelFormatter={(l) => `Tuần bắt đầu ${l}`}
                contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 13 }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="vn" name="Việt Nam" stackId="route" fill="var(--chart-1)" isAnimationActive={false} />
              <Bar dataKey="global" name="Global" stackId="route" fill="var(--chart-2)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </SectionCard>
  );
}

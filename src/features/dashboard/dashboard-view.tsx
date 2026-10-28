"use client";

import { useMemo, useState } from "react";
import { LayoutDashboard } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { roleConfig } from "@/config/roles";
import { useSession } from "@/features/auth/session-provider";
import type { DashboardData } from "@/types/dashboard";
import { AttentionOrders } from "./attention-orders";
import { DashboardFilters } from "./dashboard-filters";
import { FunnelChart } from "./funnel-chart";
import { KpiGrid } from "./kpi-grid";
import { computeMetrics, resolveRange, type DeptFilter, type RangeKey } from "./metrics";
import { OverdueTasks } from "./overdue-tasks";
import { RouteChart } from "./route-chart";

export function DashboardView({ data }: { data: DashboardData }) {
  const user = useSession();
  const cfg = roleConfig[user.role];
  const locked = cfg.dashboard !== "all";

  const [rangeKey, setRangeKey] = useState<RangeKey>("30d");
  const [deptState, setDept] = useState<DeptFilter>("all");
  // Vai trò theo phòng bị khóa vào phòng của mình
  const dept: DeptFilter = locked && cfg.department ? cfg.department : deptState;

  const range = useMemo(() => resolveRange(rangeKey, data.today), [rangeKey, data.today]);
  const m = useMemo(() => computeMetrics(data, rangeKey, dept), [data, rangeKey, dept]);

  const executive = cfg.dashboard === "all";
  return (
    <>
      <PageHeader
        title={executive ? "Tổng quan điều hành" : `Tổng quan ${cfg.label}`}
        description={
          executive
            ? "Số liệu toàn công ty theo thời gian và phòng ban phụ trách."
            : "Số liệu và công việc thuộc phạm vi phòng của bạn."
        }
      />
      <DashboardFilters
        range={range}
        rangeKey={rangeKey}
        onRangeChange={setRangeKey}
        dept={dept}
        onDeptChange={setDept}
        deptLocked={locked}
      />

      {cfg.dashboard === "tasks-only" ? (
        <div className="mb-6 rounded-xl border bg-card">
          <EmptyState
            icon={LayoutDashboard}
            title="Chưa có chỉ số nghiệp vụ cho phòng này"
            description="Các chỉ số của phòng sẽ xuất hiện khi module tương ứng được triển khai. Công việc của bạn hiển thị bên dưới."
          />
        </div>
      ) : (
        <>
          <KpiGrid kpis={m.kpis} role={user.role} />
          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <FunnelChart funnel={m.funnel} />
            <RouteChart series={m.routeSeries} totals={m.routeTotals} />
          </div>
        </>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <OverdueTasks tasks={m.overdueTasks} total={m.overdueCount} />
        {cfg.dashboard !== "tasks-only" && <AttentionOrders rows={m.attentionOrders} total={m.attentionCount} />}
      </div>
    </>
  );
}

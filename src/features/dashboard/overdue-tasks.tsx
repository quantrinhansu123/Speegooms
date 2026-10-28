import { CheckCircle2 } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { departmentLabels } from "@/config/departments";
import { formatDayMonth } from "@/lib/format";
import { priorityLabels } from "./labels";
import type { DashboardMetrics } from "./metrics";

export function OverdueTasks({ tasks, total }: { tasks: DashboardMetrics["overdueTasks"]; total: number }) {
  return (
    <SectionCard
      title="Công việc quá hạn"
      description={total > 0 ? `${total} công việc chưa hoàn thành, hiển thị ${tasks.length} trễ nhất` : undefined}
      className="lg:col-span-2"
      bodyClassName="px-5 pt-2 pb-3"
    >
      {tasks.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="Không có việc quá hạn" description="Mọi công việc đang đúng tiến độ." className="py-8" />
      ) : (
        <ul className="divide-y">
          {tasks.map(({ task, daysLate }) => (
            <li key={task.id} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{task.title}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {task.assignee} · {departmentLabels[task.department]}
                  {task.orderId && ` · ${task.orderId}`}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Hạn {formatDayMonth(task.dueDate)} · {priorityLabels[task.priority]}
                </p>
              </div>
              <StatusBadge tone={daysLate >= 5 ? "danger" : "warning"}>Trễ {daysLate} ngày</StatusBadge>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

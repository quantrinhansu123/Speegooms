"use client";

import { CalendarDays } from "lucide-react";
import { departmentOptions } from "@/config/departments";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { rangeOptions, type DeptFilter, type Range, type RangeKey } from "./metrics";

export function DashboardFilters({
  range,
  rangeKey,
  onRangeChange,
  dept,
  onDeptChange,
  deptLocked,
}: {
  range: Range;
  rangeKey: RangeKey;
  onRangeChange: (key: RangeKey) => void;
  dept: DeptFilter;
  onDeptChange: (dept: DeptFilter) => void;
  /** Vai trò theo phòng: khóa bộ lọc phòng ban */
  deptLocked: boolean;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end gap-x-6 gap-y-3 rounded-xl border bg-card px-4 py-3 shadow-xs">
      <div>
        <p id="range-label" className="mb-1.5 text-xs font-medium text-muted-foreground">
          Thời gian
        </p>
        <div role="group" aria-labelledby="range-label" className="inline-flex rounded-lg bg-muted p-0.5">
          {rangeOptions.map((o) => (
            <button
              key={o.key}
              type="button"
              aria-pressed={rangeKey === o.key}
              onClick={() => onRangeChange(o.key)}
              className={cn(
                "h-8 rounded-md px-3 text-sm font-medium transition-colors",
                rangeKey === o.key
                  ? "bg-surface text-primary shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="dept-filter" className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Phòng ban phụ trách
        </label>
        <select
          id="dept-filter"
          value={dept}
          disabled={deptLocked}
          onChange={(e) => onDeptChange(e.target.value as DeptFilter)}
          className="h-10 min-w-48 rounded-lg border border-input bg-surface px-3 text-sm outline-none focus-visible:border-ring/70 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
        >
          <option value="all">Tất cả phòng ban</option>
          {departmentOptions.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      <p className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground">
        <CalendarDays aria-hidden className="size-4" />
        {formatDate(range.from)} – {formatDate(range.to)}
      </p>
    </div>
  );
}

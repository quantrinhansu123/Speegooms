import { z } from "zod";
import type { KpiDefinition } from "./kpi";
import type { MessageProcessingStatus } from "./crm";
import type { Role } from "./user";

export const salesReportDepartments = ["sale-vn", "sale-global"] as const;
export type SalesReportDepartment = typeof salesReportDepartments[number];
export const salesReportMetricCodes = {
  selfSourced: "SALE_SELF_SOURCED",
  potentials: "SALE_POTENTIALS",
  quoteRate: "SALE_QUOTE_RATE",
  closeRate: "SALE_CLOSE_RATE",
  revenue: "SALE_REVENUE_VND",
} as const;

export function canViewSalesReport(role: Role): boolean {
  return role === "admin" || role === "ban-gd" || role === "sale-global-lead" || role === "sale-vn" || role === "sale-global";
}

export const salesReportQuery = z.discriminatedUnion("view", [
  z.object({ view: z.literal("processing") }),
  z.object({ view: z.enum(["week", "month"]), date: z.iso.date().refine((date) => date >= "1900-02-01" && date <= "9998-12-31") }),
]);
export type SalesReportQuery = z.infer<typeof salesReportQuery>;
export type SalesPeriod = { start: string; end: string };

const dayMs = 86_400_000;
const iso = (date: Date) => date.toISOString().slice(0, 10);
const utcDay = (date: string) => new Date(`${date}T00:00:00Z`);
export const salesReportToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export const shiftSalesDay = (date: string, days: number) => iso(new Date(utcDay(date).getTime() + days * dayMs));

export function salesReportPeriods(view: "week" | "month", date: string) {
  const day = utcDay(date);
  if (view === "week") {
    const start = shiftSalesDay(date, -day.getUTCDay());
    return { current: { start, end: shiftSalesDay(start, 7) }, previous: { start: shiftSalesDay(start, -7), end: start } };
  }
  const year = day.getUTCFullYear();
  const month = day.getUTCMonth();
  const start = iso(new Date(Date.UTC(year, month, 1)));
  return {
    current: { start, end: iso(new Date(Date.UTC(year, month + 1, 1))) },
    previous: { start: iso(new Date(Date.UTC(year, month - 1, 1))), end: start },
  };
}

export type SalesMetrics = { selfSourced: number; potentials: number; quoted: number; closed: number; revenue: number; missingRates: number };
export type SalesReportMember = { id: string; name: string; department: SalesReportDepartment };
export type SalesProcessingCounts = Partial<Record<MessageProcessingStatus, number>>;
export type SalesPerformanceReport = {
  members: SalesReportMember[];
  headcounts: Record<SalesReportDepartment, number>;
  definitions: KpiDefinition[];
  rows: { id: string; current: SalesMetrics; previous: SalesMetrics }[];
  /** Mục tiêu giao riêng từng người trong kỳ đang xem: userId → mã chỉ tiêu → số. */
  targets?: Record<string, Record<string, number>>;
};
export type SalesProcessingReport = { members: SalesReportMember[]; counts: Record<string, SalesProcessingCounts> };

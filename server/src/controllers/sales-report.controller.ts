import { canViewSalesReport, salesReportDepartments, salesReportMetricCodes, salesReportPeriods, salesReportQuery, type SalesPerformanceReport } from "@speego/shared";
import type { Request, Response } from "express";
import type { PostgresKpiRepository } from "../adapters/postgres/kpi.repository";
import type { PostgresSalesReportRepository } from "../adapters/postgres/sales-report.repository";
import type { PostgresTargetsRepository } from "../adapters/postgres/targets.repository";
import { AppError } from "../lib/errors";

const metricCodes = new Set<string>(Object.values(salesReportMetricCodes));

export class SalesReportController {
  constructor(private readonly report: PostgresSalesReportRepository | null, private readonly kpis: PostgresKpiRepository | null, private readonly targets: PostgresTargetsRepository | null = null) {}

  read = async (req: Request, res: Response) => {
    const actor = req.user;
    if (!actor) throw new AppError(401, "UNAUTHENTICATED", "Chưa đăng nhập");
    if (!canViewSalesReport(actor.role)) throw new AppError(403, "FORBIDDEN", "Không có quyền xem báo cáo Sale");
    if (!this.report || !this.kpis) throw new AppError(503, "UNAVAILABLE", "Báo cáo Sale cần kết nối Postgres");
    const query = salesReportQuery.safeParse(req.query);
    if (!query.success) throw new AppError(400, "INVALID", "Kỳ báo cáo không hợp lệ");
    res.setHeader("Cache-Control", "private, no-store");
    const result = await this.report.read(actor, query.data);
    if ("counts" in result || query.data.view === "processing") {
      res.json(result);
      return;
    }
    const departments = salesReportDepartments.filter((department) => result.headcounts[department] > 0);
    const definitions = (await this.kpis.list(departments)).filter((definition) =>
      definition.active && definition.target !== null && metricCodes.has(definition.code));
    // Mục tiêu giao theo từng người trong kỳ đang xem; người chưa được giao thì báo cáo dùng KPI phòng.
    const targets = this.targets
      ? await this.targets.forReport(result.members.map((member) => member.id), query.data.view, salesReportPeriods(query.data.view, query.data.date).current.start)
      : {};
    res.json({ ...result, definitions, targets } satisfies SalesPerformanceReport);
  };
}

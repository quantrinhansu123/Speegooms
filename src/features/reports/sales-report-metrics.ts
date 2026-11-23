import { salesReportMetricCodes, shiftSalesDay, type SalesMetrics, type SalesPerformanceReport, type SalesPeriod, type SalesReportMember } from "@speego/shared";

export const salesMetrics = [
  { key: "selfSourced", label: "Khách hàng mới tự tìm", kind: "count" },
  { key: "potentials", label: "Khách tiềm năng", kind: "count" },
  { key: "quoteRate", label: "Tỷ lệ báo giá / Khách tiềm năng", kind: "rate" },
  { key: "closeRate", label: "Tỷ lệ chốt / Báo giá", kind: "rate" },
  { key: "revenue", label: "Doanh số (VNĐ)", kind: "money" },
] as const;

export const percentOf = (part: number, total: number) => total > 0 ? part / total * 100 : null;

function targetDays(period: SalesPeriod, kpiPeriod: "month" | "quarter" | "year") {
  let fraction = 0;
  for (let date = period.start; date < period.end; date = shiftSalesDay(date, 1)) {
    const year = Number(date.slice(0, 4));
    const month = Number(date.slice(5, 7)) - 1;
    const startMonth = kpiPeriod === "year" ? 0 : kpiPeriod === "quarter" ? Math.floor(month / 3) * 3 : month;
    const months = kpiPeriod === "year" ? 12 : kpiPeriod === "quarter" ? 3 : 1;
    const duration = (Date.UTC(year, startMonth + months, 1) - Date.UTC(year, startMonth, 1)) / 86_400_000;
    fraction += 1 / duration;
  }
  return fraction;
}

export function performanceRows(report: SalesPerformanceReport, members: SalesReportMember[], period: SalesPeriod) {
  const selected = new Set(members.map(({ id }) => id));
  const rows = report.rows.filter(({ id }) => selected.has(id));
  const totals = (key: "current" | "previous") => {
    const sum = (metric: keyof SalesMetrics) => rows.reduce((total, row) => total + row[key][metric], 0);
    return {
      selfSourced: sum("selfSourced"),
      potentials: sum("potentials"),
      quoteRate: percentOf(sum("quoted"), sum("potentials")),
      closeRate: percentOf(sum("closed"), sum("quoted")),
      revenue: sum("missingRates") > 0 ? null : sum("revenue"),
      missingRates: sum("missingRates"),
    };
  };
  const current = totals("current");
  const previous = totals("previous");

  return {
    missingRates: current.missingRates + previous.missingRates,
    rows: salesMetrics.map((metric) => {
      const code = salesReportMetricCodes[metric.key];
      const targets = members.flatMap(({ id, department }) => {
        // Mục tiêu giao riêng từng người được ưu tiên; chưa giao thì lấy KPI phòng chia theo số Sale và số ngày.
        const personal = report.targets?.[id]?.[code];
        if (personal !== undefined) return [personal];
        const definition = report.definitions.find((def) => def.department === department && def.code === code);
        if (!definition || definition.target === null) return [];
        if (metric.kind === "rate") return [definition.target];
        return [definition.target * targetDays(period, definition.period) / report.headcounts[department]];
      });
      const target = targets.length === 0 || targets.length !== members.length ? null
        : targets.reduce((a, b) => a + b, 0) / (metric.kind === "rate" ? targets.length : 1);
      const actual = current[metric.key];
      return { ...metric, target, actual, previous: previous[metric.key], completion: target == null || actual == null ? null : percentOf(actual, target) };
    }),
  };
}

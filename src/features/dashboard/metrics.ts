import type { Department } from "@/types/role";
import type { AttentionReason, DashboardData, Order, Route, Task } from "@/types/dashboard";

export type RangeKey = "7d" | "30d" | "90d" | "month";
export type DeptFilter = Department | "all";

export const rangeOptions: { key: RangeKey; label: string }[] = [
  { key: "7d", label: "7 ngày" },
  { key: "30d", label: "30 ngày" },
  { key: "90d", label: "90 ngày" },
  { key: "month", label: "Tháng này" },
];

const DAY = 864e5;
const toTime = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const toIso = (t: number) => new Date(t).toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => toIso(toTime(iso) + n * DAY);
const daysBetween = (a: string, b: string) => Math.round((toTime(b) - toTime(a)) / DAY);

export interface Range {
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
}

export function resolveRange(key: RangeKey, today: string): Range {
  const from =
    key === "month" ? `${today.slice(0, 8)}01` : addDays(today, -({ "7d": 7, "30d": 30, "90d": 90 }[key] - 1));
  const length = daysBetween(from, today) + 1;
  return { from, to: today, prevFrom: addDays(from, -length), prevTo: addDays(from, -1) };
}

const inRange = (date: string, from: string, to: string) => date >= from && date <= to;
const pct = (cur: number, prev: number) => (prev === 0 ? undefined : Math.round(((cur - prev) / prev) * 1000) / 10);

export interface Kpi {
  value: number;
  /** % thay đổi so với kỳ trước; undefined nếu là chỉ số tại thời điểm hiện tại */
  delta?: number;
}

export interface DashboardMetrics {
  kpis: {
    newLeads: Kpi;
    rfqProcessing: Kpi;
    ordersActive: Kpi;
    ordersPendingDeposit: Kpi;
    contractValue: Kpi;
    receivable: Kpi;
  };
  funnel: { leads: number; rfqs: number; orders: number; leadToRfq: number; rfqToOrder: number };
  routeSeries: { label: string; from: string; vn: number; global: number }[];
  routeTotals: Record<Route, number>;
  overdueTasks: { task: Task; daysLate: number }[];
  overdueCount: number;
  attentionOrders: { order: Order; customer: string }[];
  attentionCount: number;
}

const attentionWeight: Record<AttentionReason, number> = {
  "qua-han-giao": 5,
  "cong-no-qua-han": 4,
  "cho-coc-lau": 3,
  "thieu-chung-tu": 2,
  "khieu-nai": 2,
};

/**
 * Chỉ số theo bộ lọc. Quy ước:
 * - Lead mới, RFQ, đơn, giá trị hợp đồng (luồng): theo ngày tạo trong khoảng thời gian.
 * - RFQ đang xử lý, đơn đang thực hiện, đơn chờ cọc, công nợ (tồn): tại thời điểm hiện tại.
 * - Giá trị hợp đồng không tính đơn hủy; công nợ = giá trị - đã thu của đơn đang thực hiện/hoàn tất.
 * - Phòng ban: Sale VN/Global lọc theo tuyến; các phòng còn lại theo phòng đang giữ bản ghi.
 *   Công việc luôn lọc theo phòng của công việc.
 */
export function computeMetrics(data: DashboardData, rangeKey: RangeKey, dept: DeptFilter): DashboardMetrics {
  const range = resolveRange(rangeKey, data.today);
  const byDept = <T extends { department: Department }>(rows: T[]) =>
    dept === "all" ? rows : rows.filter((r) => r.department === dept);
  // Sale sở hữu cả tuyến (VN/Global) từ lead đến đơn, kể cả khi đơn đang ở Vận hành/Kế toán
  const saleRoute: Partial<Record<DeptFilter, Route>> = { "sale-vn": "vn", "sale-global": "global" };
  const byOwner = <T extends { department: Department; route: Route }>(rows: T[]) => {
    const route = saleRoute[dept];
    return route ? rows.filter((r) => r.route === route) : byDept(rows);
  };

  const leads = byOwner(data.leads);
  const rfqs = byOwner(data.rfqs);
  const orders = byOwner(data.orders);
  const tasks = byDept(data.tasks);

  const count = <T extends { createdAt: string }>(rows: T[], from: string, to: string) =>
    rows.filter((r) => inRange(r.createdAt, from, to)).length;
  const contract = (from: string, to: string) =>
    orders.filter((o) => o.status !== "da-huy" && inRange(o.createdAt, from, to)).reduce((s, o) => s + o.contractValue, 0);

  const newLeads = count(leads, range.from, range.to);
  const rfqInRange = count(rfqs, range.from, range.to);
  const ordersInRange = orders.filter((o) => o.status !== "da-huy" && inRange(o.createdAt, range.from, range.to));
  const contractValue = contract(range.from, range.to);

  const receivable = orders
    .filter((o) => o.status === "dang-thuc-hien" || o.status === "hoan-tat")
    .reduce((s, o) => s + (o.contractValue - o.paidAmount), 0);

  // Biểu đồ đơn theo tuyến: gom theo tuần (7 ngày) từ đầu khoảng thời gian
  const buckets: DashboardMetrics["routeSeries"] = [];
  for (let start = range.from; start <= range.to; start = addDays(start, 7)) {
    buckets.push({ label: start.slice(5).split("-").reverse().join("/"), from: start, vn: 0, global: 0 });
  }
  for (const o of ordersInRange) {
    const b = buckets[Math.floor(daysBetween(range.from, o.createdAt) / 7)];
    if (b) b[o.route] += 1;
  }

  const customerName = new Map(data.customers.map((c) => [c.id, c.name]));
  const overdueAll = tasks
    .filter((t) => !t.done && t.dueDate < data.today)
    .map((task) => ({ task, daysLate: daysBetween(task.dueDate, data.today) }))
    .sort((a, b) => b.daysLate - a.daysLate);
  const attentionAll = orders
    .filter((o) => o.attention && o.status !== "da-huy")
    .sort((a, b) => attentionWeight[b.attention!] - attentionWeight[a.attention!] || b.contractValue - a.contractValue);

  return {
    kpis: {
      newLeads: { value: newLeads, delta: pct(newLeads, count(leads, range.prevFrom, range.prevTo)) },
      rfqProcessing: { value: rfqs.filter((r) => r.status === "dang-xu-ly").length },
      ordersActive: { value: orders.filter((o) => o.status === "dang-thuc-hien").length },
      ordersPendingDeposit: { value: orders.filter((o) => o.status === "cho-coc").length },
      contractValue: { value: contractValue, delta: pct(contractValue, contract(range.prevFrom, range.prevTo)) },
      receivable: { value: receivable },
    },
    funnel: {
      leads: newLeads,
      rfqs: rfqInRange,
      orders: ordersInRange.length,
      leadToRfq: newLeads ? Math.round((rfqInRange / newLeads) * 100) : 0,
      rfqToOrder: rfqInRange ? Math.round((ordersInRange.length / rfqInRange) * 100) : 0,
    },
    routeSeries: buckets,
    routeTotals: {
      vn: ordersInRange.filter((o) => o.route === "vn").length,
      global: ordersInRange.filter((o) => o.route === "global").length,
    },
    overdueTasks: overdueAll.slice(0, 5),
    overdueCount: overdueAll.length,
    attentionOrders: attentionAll.slice(0, 6).map((order) => ({ order, customer: customerName.get(order.customerId) ?? order.customerId })),
    attentionCount: attentionAll.length,
  };
}

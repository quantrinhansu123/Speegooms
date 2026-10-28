import { roleRouteScope, routeLabels, sourceLabels } from "../../config/crm.ts";
import { canViewReport, type ReportKey } from "../../config/reports.ts";
import { shipmentStatusMeta } from "../../config/operations.ts";
import { buildOrderViews, delayDays, doneCount, orderStages, shipmentStatus } from "../ops/rules.ts";
import { buildPayables, buildReceivables } from "../accounting/rules.ts";
import { date, sourceMetrics } from "../backoffice/rules.ts";
import type { CrmSnapshot } from "../../types/crm.ts";
import type { OpsSnapshot } from "../../types/ops.ts";
import type { AccountingSnapshot } from "../../types/accounting.ts";
import type { FulfillmentSnapshot } from "../../types/fulfillment.ts";
import type { Role } from "../../types/role.ts";

export type ReportRow = { id: string; [key: string]: string | number };
export interface ReportColumn { key: string; label: string; kind?: "number" | "percent" | "date" | "vnd" | "usd" }
export interface ReportData { columns: ReportColumn[]; rows: ReportRow[]; summary?: string }
export interface ReportInput { crm: CrmSnapshot; ops: OpsSnapshot; acc: AccountingSnapshot; wh: FulfillmentSnapshot; today: string }
const col = (key: string, label: string, kind?: ReportColumn["kind"]): ReportColumn => ({ key, label, kind });
const inRange = (date: string | undefined, from: string, to: string) => !!date && date.slice(0, 10) >= from && date.slice(0, 10) <= to;

export function buildReport(input: ReportInput, key: ReportKey, role: Role, from: string, to: string): ReportData {
  if (!canViewReport(role, key) || !date.safeParse(from).success || !date.safeParse(to).success || from > to) return { columns: [], rows: [] };
  const scope = roleRouteScope[role];
  const { ops, wh, acc, today } = input;
  const crm = {
    ...input.crm,
    leads: input.crm.leads.filter((l) => !scope || l.goodsOrigin === (scope === "vn" ? "vn" : "cn")),
    rfqs: input.crm.rfqs.filter((r) => !scope || r.route === scope),
    contracts: input.crm.contracts.filter((c) => !scope || c.route === scope),
  };
  const contractMap = new Map(crm.contracts.map((c) => [c.orderId, c]));
  const metricColumns = [col("name", "Nguồn / Tuyến"), col("leads", "Lead", "number"), col("rfq", "Lead có RFQ", "number"), col("orders", "Lead có đơn", "number"), col("rfqRate", "Lead → RFQ", "percent"), col("orderRate", "Lead → đơn", "percent")];
  if (key === "conversion" || key === "marketing") {
    const rows = sourceMetrics(crm.leads, crm.rfqs, crm.contracts, from, to).map((m) => ({ ...m, id: m.source, name: sourceLabels[m.source] }));
    return { columns: metricColumns, rows };
  }
  if (key === "sales") {
    const cohort = crm.leads.filter((l) => inRange(l.createdAt, from, to));
    const rows: ReportRow[] = [];
    for (const route of (["vn", "global"] as const).filter((r) => !scope || scope === r)) {
      const leads = cohort.filter((l) => l.goodsOrigin === (route === "vn" ? "vn" : "cn"));
      const owners = new Set(leads.map((l) => l.ownerId));
      for (const owner of owners) {
        const mine = leads.filter((l) => l.ownerId === owner);
        const ids = new Set(mine.map((l) => l.messId));
        const rfq = new Set(crm.rfqs.filter((r) => ids.has(r.messId) && r.status !== "da-huy").map((r) => r.messId)).size;
        const contracts = crm.contracts.filter((c) => ids.has(c.messId) && c.status === "da-ky");
        const orders = new Set(contracts.map((c) => c.messId)).size;
        rows.push({ id: `${route}-${owner}`, name: crm.staff.find((s) => s.id === owner)?.name ?? owner, route: routeLabels[route], leads: ids.size, rfq, orders, orderRate: ids.size ? orders / ids.size * 100 : 0, vnd: contracts.filter((c) => c.currency === "VND").reduce((s, c) => s + c.value, 0), usd: contracts.filter((c) => c.currency === "USD").reduce((s, c) => s + c.value, 0) });
      }
    }
    return { columns: [col("name", "Sale"), col("route", "Tuyến"), ...metricColumns.slice(1, 4), col("orderRate", "Lead → đơn", "percent"), col("vnd", "Giá trị ký (VND)", "vnd"), col("usd", "Giá trị ký (USD)", "usd")], rows };
  }
  if (key === "orders") {
    const rows = buildOrderViews(crm, ops, today).filter((o) => inRange(o.contract.createdAt, from, to)).map((o) => ({ id: o.contract.orderId, customer: o.customer?.name ?? o.contract.customerId, route: routeLabels[o.contract.route], created: o.contract.createdAt, stage: orderStages.find((s) => s.key === o.stage)?.label ?? o.stage, due: o.state.dueOn || "", late: o.daysOverdue, shipments: o.shipments.length }));
    return { columns: [col("id", "Đơn hàng"), col("customer", "Khách hàng"), col("route", "Tuyến"), col("created", "Ngày tạo", "date"), col("stage", "Tiến độ"), col("due", "Hạn giao", "date"), col("late", "Ngày quá hạn", "number"), col("shipments", "Số lô", "number")], rows, summary: `${rows.length} đơn đã ký trong kỳ; trạng thái hiện tại.` };
  }
  if (key === "shipments") {
    return { columns: [col("id", "Lô hàng"), col("order", "Đơn hàng"), col("etd", "ETD", "date"), col("eta", "ETA", "date"), col("status", "Trạng thái"), col("progress", "Tiến độ mốc", "percent"), col("late", "Chậm mốc (ngày)", "number")], rows: ops.shipments.filter((s) => contractMap.has(s.orderId) && inRange(s.etd, from, to)).map((s) => ({ id: s.shipmentId, order: s.orderId, etd: s.etd, eta: s.eta, status: shipmentStatusMeta[shipmentStatus(s)].label, progress: doneCount(s) / 6 * 100, late: delayDays(s, today) })) };
  }
  if (key === "ontime") {
    const deadlines = new Map(ops.orders.map((o) => [o.orderId, o.dueOn]));
    const deliveries = wh.deliveries.filter((d) => contractMap.has(d.orderId) && d.status === "da-giao" && d.pod && inRange(d.deliveredAt, from, to));
    const rows = deliveries.map((d) => {
      const due = deadlines.get(d.orderId) ?? "";
      const actual = d.deliveredAt!.slice(0, 10);
      return { id: d.deliveryId, order: d.orderId, actual, due, result: !due ? "Chưa có hạn" : actual <= due ? "Đúng hạn" : "Trễ hạn" };
    });
    const eligible = rows.filter((r) => r.due);
    const ontime = eligible.filter((r) => r.result === "Đúng hạn").length;
    return { columns: [col("id", "Lượt giao"), col("order", "Đơn hàng"), col("actual", "Giao thực tế", "date"), col("due", "Hạn đơn", "date"), col("result", "Kết quả")], rows, summary: eligible.length ? `Đúng hạn ${ontime}/${eligible.length} lượt có hạn (${(ontime / eligible.length * 100).toFixed(1)}%). ${rows.length - eligible.length} lượt thiếu hạn không tính tỷ lệ.` : "Chưa đủ lượt giao có POD và thời hạn để tính tỷ lệ; không hiển thị 0% khi thiếu dữ liệu." };
  }
  if (key === "debts") {
    const receivables = buildReceivables(crm, ops, acc, today).filter((r) => r.contract.currency === "VND" && inRange(r.contract.createdAt, from, to));
    const scopedAcc = { ...acc, payments: acc.payments.filter((p) => inRange(p.requestedAt, from, to)) };
    const rows: ReportRow[] = [
      ...receivables.map((r) => ({ id: r.contract.orderId, type: "Phải thu", name: r.customerName, committed: r.contract.value, paid: r.received, outstanding: r.outstanding, currency: r.contract.currency, overdue: r.overdueDays })),
      ...buildPayables(ops, scopedAcc).map((r) => ({ id: r.payeeId, type: "Phải trả", name: r.name, committed: r.committed, paid: r.paid, outstanding: r.outstanding, currency: "VND", overdue: "Chưa có hạn chi" })),
    ];
    return { columns: [col("id", "Tham chiếu"), col("type", "Loại"), col("name", "Đối tượng"), col("currency", "Tiền tệ"), col("committed", "Giá trị/cam kết", "number"), col("paid", "Đã thu/chi", "number"), col("outstanding", "Còn lại", "number"), col("overdue", "Quá hạn (ngày)")], rows, summary: "Chỉ tính công nợ VND theo mô hình Kế toán hiện có; hợp đồng ngoại tệ cần chốt quy tắc thu/chi và quy đổi trước khi đưa vào báo cáo." };
  }
  const pos = ops.pos.filter((p) => p.status !== "huy" && inRange(p.createdAt, from, to));
  const rows = ops.suppliers.map((s) => {
    const mine = pos.filter((p) => p.supplierId === s.supplierId);
    return { id: s.supplierId, name: s.name, pos: mine.length, committed: mine.reduce((sum, p) => sum + p.amount, 0), ready: mine.filter((p) => p.status === "san-sang" || p.status === "da-giao-vc").length, rating: s.rating, ontime: s.onTimeRate };
  }).filter((s) => s.pos > 0);
  return { columns: [col("id", "Mã NCC"), col("name", "Nhà cung cấp"), col("pos", "PO trong kỳ", "number"), col("committed", "Giá trị PO (VND)", "vnd"), col("ready", "PO sẵn sàng/đã giao", "number"), col("rating", "Điểm mock / 5", "number"), col("ontime", "Đúng hạn hồ sơ (mock)", "percent")], rows };
}

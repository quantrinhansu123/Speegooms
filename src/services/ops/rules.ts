import { handoverItems, milestones, qcItems, requiredDocs } from "../../config/operations.ts";
import type { Contract, CrmSnapshot, Customer, Rfq } from "@/types/crm";
import type {
  OpsDocument,
  OpsOrder,
  OpsSnapshot,
  PurchaseOrder,
  Shipment,
  ShipmentStatus,
  SourcingRequest,
  SupplierQuote,
} from "@/types/ops";

/** Quy tắc nghiệp vụ Vận hành thuần (không phụ thuộc UI/store). Kiểm tra bằng pnpm check:ops. */

const DAY = 864e5;
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
export const addDays = (iso: string, n: number) => new Date(Date.parse(iso) + n * DAY).toISOString().slice(0, 10);

// ---- Lô hàng
export const doneCount = (s: Shipment) => milestones.filter((m) => s.milestones[m.key].actualOn).length;

export function shipmentStatus(s: Shipment): ShipmentStatus {
  const c = doneCount(s);
  if (c === 0) return "chua-nhan";
  if (c <= 2) return "dang-xu-ly";
  if (c === 3) return "dang-van-chuyen";
  if (c === 4) return "thong-quan";
  if (c === 5) return "da-den-kho";
  return "da-giao";
}

/** Số ngày chậm lớn nhất của các mốc đã quá kế hoạch mà chưa hoàn thành (0 nếu đúng tiến độ). */
export function delayDays(s: Shipment, today: string) {
  return milestones.reduce((max, m) => {
    const ms = s.milestones[m.key];
    return !ms.actualOn && ms.plannedOn < today ? Math.max(max, daysBetween(ms.plannedOn, today)) : max;
  }, 0);
}
export const isDelayed = (s: Shipment, today: string) => delayDays(s, today) > 0;

export const nextMilestone = (s: Shipment) => milestones.find((m) => !s.milestones[m.key].actualOn);

// ---- Cổng đặt xưởng
/**
 * Không cho đặt xưởng khi Kế toán chưa xác nhận "Đã cọc". Ngoài ra Vận hành phải nhận bàn giao đủ thông tin.
 */
export function canPlacePo(contract: Contract | undefined, order: OpsOrder | undefined): { ok: boolean; reason?: string } {
  if (!contract) return { ok: false, reason: "Không tìm thấy hợp đồng của đơn" };
  if (contract.deposit.status !== "da-coc") return { ok: false, reason: "Chưa có xác nhận Đã cọc của Kế toán, không được đặt xưởng" };
  if (order?.handover.status !== "da-nhan") return { ok: false, reason: "Vận hành chưa xác nhận nhận bàn giao đủ thông tin từ Sale" };
  return { ok: true };
}

export const canAdvanceToReady = (po: PurchaseOrder) =>
  qcItems.every((q) => ["dat", "khong-ap-dung"].includes(po.qc[q.id]?.result ?? "cho"));

// ---- Báo giá nhà cung cấp
export const quoteTotal = (q: Pick<SupplierQuote, "goodsUnitPrice" | "quantity" | "freightCost" | "handlingFee">) => ({
  goods: q.goodsUnitPrice * q.quantity,
  freight: q.freightCost,
  fees: q.handlingFee,
  total: q.goodsUnitPrice * q.quantity + q.freightCost + q.handlingFee,
});

// ---- Đơn hàng
export type OrderStage = "cho-coc" | "cho-ban-giao" | "cho-dat-xuong" | "dang-san-xuat" | "chuan-bi-van-chuyen" | "dang-van-chuyen" | "thong-quan" | "da-giao";

/** 8 bước tiến độ dùng cho timeline đơn hàng. CHƯA phải "8 mốc" chính thức của tài liệu (chưa liệt kê). */
export const orderStages: { key: OrderStage; label: string }[] = [
  { key: "cho-coc", label: "Chờ xác nhận cọc" },
  { key: "cho-ban-giao", label: "Bàn giao Sale → Vận hành" },
  { key: "cho-dat-xuong", label: "Đặt xưởng" },
  { key: "dang-san-xuat", label: "Sản xuất và QC" },
  { key: "chuan-bi-van-chuyen", label: "Nhận hàng, chuẩn bị vận chuyển" },
  { key: "dang-van-chuyen", label: "Vận chuyển quốc tế" },
  { key: "thong-quan", label: "Thông quan, về kho" },
  { key: "da-giao", label: "Đã giao hàng" },
];

export interface OrderAlert {
  kind: "thieu-thong-tin" | "qua-han" | "cho-xac-nhan";
  level: "danger" | "warning";
  text: string;
}

export interface OrderView {
  contract: Contract;
  customer?: Customer;
  rfq?: Rfq;
  state: OpsOrder;
  po?: PurchaseOrder;
  shipments: Shipment[];
  documents: OpsDocument[];
  request?: SourcingRequest;
  stage: OrderStage;
  alerts: OrderAlert[];
  daysOverdue: number;
}

const emptyState = (c: Contract): OpsOrder => ({
  orderId: c.orderId,
  assigneeId: "",
  dueOn: "",
  handover: { items: Object.fromEntries(handoverItems.map((i) => [i.id, false])), status: "cho-xac-nhan" },
});

export function deriveStage(contract: Contract, state: OpsOrder, po: PurchaseOrder | undefined, shipments: Shipment[]): OrderStage {
  if (contract.deposit.status !== "da-coc") return "cho-coc";
  if (state.handover.status !== "da-nhan") return "cho-ban-giao";
  if (shipments.length > 0) {
    const st = shipments.map(shipmentStatus);
    if (st.every((x) => x === "da-giao")) return "da-giao";
    if (st.some((x) => x === "thong-quan" || x === "da-den-kho")) return "thong-quan";
    if (st.some((x) => x === "dang-van-chuyen")) return "dang-van-chuyen";
    return "chuan-bi-van-chuyen";
  }
  if (!po || po.status === "nhap" || po.status === "huy") return "cho-dat-xuong";
  if (po.status === "san-sang" || po.status === "da-giao-vc") return "chuan-bi-van-chuyen";
  return "dang-san-xuat";
}

export function buildOrderViews(crm: CrmSnapshot, ops: OpsSnapshot, today: string): OrderView[] {
  const customers = new Map(crm.customers.map((c) => [c.customerId, c]));
  const rfqs = new Map(crm.rfqs.map((r) => [r.rfqId, r]));
  const states = new Map(ops.orders.map((o) => [o.orderId, o]));
  const pos = new Map(ops.pos.filter((p) => p.status !== "huy").map((p) => [p.orderId, p]));
  const requests = new Map(ops.requests.map((r) => [r.rfqId, r]));
  const shipByOrder = new Map<string, Shipment[]>();
  for (const s of ops.shipments) shipByOrder.set(s.orderId, [...(shipByOrder.get(s.orderId) ?? []), s]);
  const docsByOrder = new Map<string, OpsDocument[]>();
  for (const d of ops.documents) docsByOrder.set(d.orderId, [...(docsByOrder.get(d.orderId) ?? []), d]);

  return crm.contracts
    .filter((c) => c.status === "da-ky")
    .map((contract) => {
      const state = states.get(contract.orderId) ?? emptyState(contract);
      const po = pos.get(contract.orderId);
      const shipments = shipByOrder.get(contract.orderId) ?? [];
      const documents = docsByOrder.get(contract.orderId) ?? [];
      const stage = deriveStage(contract, state, po, shipments);
      const alerts: OrderAlert[] = [];
      const missing = handoverItems.filter((i) => !state.handover.items[i.id]);

      if (stage === "cho-coc") alerts.push({ kind: "cho-xac-nhan", level: "warning", text: "Chờ Kế toán xác nhận Đã cọc, chưa được đặt xưởng" });
      if (state.handover.status === "tra-lai") alerts.push({ kind: "thieu-thong-tin", level: "danger", text: `Bàn giao bị trả lại: ${state.handover.note ?? "thiếu thông tin"}` });
      else if (contract.deposit.status === "da-coc" && state.handover.status === "cho-xac-nhan")
        alerts.push({ kind: "cho-xac-nhan", level: "warning", text: `Chờ Vận hành xác nhận bàn giao${missing.length ? ` (còn ${missing.length} mục chưa tích)` : ""}` });
      for (const s of shipments) {
        const d = delayDays(s, today);
        if (d > 0) alerts.push({ kind: "qua-han", level: "danger", text: `Lô ${s.shipmentId} chậm tiến độ ${d} ngày` });
      }
      const lacking = documents.filter((d) => (d.status === "thieu" || d.status === "tu-choi") && requiredDocs(shipments.find((s) => s.shipmentId === d.shipmentId)?.mode ?? "air").includes(d.type)).length;
      const inFlight = shipments.some((s) => doneCount(s) >= 2 && doneCount(s) < 6);
      if (inFlight && lacking > 0) alerts.push({ kind: "thieu-thong-tin", level: "warning", text: `Thiếu hoặc bị từ chối ${lacking} chứng từ` });
      const daysOverdue = state.dueOn && stage !== "da-giao" && state.dueOn < today ? daysBetween(state.dueOn, today) : 0;
      if (daysOverdue > 0) alerts.unshift({ kind: "qua-han", level: "danger", text: `Quá hạn giao ${daysOverdue} ngày` });

      return { contract, customer: customers.get(contract.customerId), rfq: rfqs.get(contract.rfqId), state, po, shipments, documents, request: requests.get(contract.rfqId), stage, alerts, daysOverdue };
    });
}

export const nextSeq = (prefix: string, ids: string[], width: number) => {
  const max = ids.reduce((m, id) => {
    const n = id.startsWith(prefix) ? Number(id.slice(prefix.length)) : NaN;
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `${prefix}${String(max + 1).padStart(width, "0")}`;
};

import { CRM_TODAY } from "@/config/crm";
import { handoverItems, milestones, opsPermissions, poFlow, qcItems, requiredDocs, type OpsAction } from "@/config/operations";
import { actions as crmActions, getSnapshot as getCrm } from "@/features/crm/store";
import { localOpsRepository } from "@/services/ops/repository";
import { addDays, canAdvanceToReady, canPlacePo, nextMilestone, nextSeq } from "@/services/ops/rules";
import type { TransportMode } from "@/types/crm";
import type {
  CostSet,
  DocType,
  MilestoneKey,
  OpsOrder,
  OpsSnapshot,
  PurchaseOrder,
  QcResult,
  Shipment,
  SupplierCountry,
  SupplierQuote,
  SupplierStatus,
} from "@/types/ops";
import type { Role } from "@/types/role";

/**
 * Store Vận hành (external store), cùng cách làm với CRM. Đọc hợp đồng/cọc từ CRM store để áp cổng "Đã cọc".
 * Mọi thao tác kiểm quyền, kiểm luật nghiệp vụ và ghi lịch sử (người làm + thời điểm).
 */
export interface Actor {
  id: string;
  role: Role;
}
export type Result = { ok: true; id?: string } | { ok: false; error: string };
export interface OpsState {
  status: "loading" | "ready";
  data: OpsSnapshot;
}

const empty: OpsSnapshot = { staff: [], suppliers: [], partners: [], requests: [], supplierQuotes: [], pos: [], orders: [], shipments: [], trackingEvents: [], documents: [], history: [] };
const LOADING: OpsState = { status: "loading", data: empty };
let state: OpsState = LOADING;
let started = false;
const listeners = new Set<() => void>();
const repo = localOpsRepository;

const emit = () => listeners.forEach((l) => l());
export const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const getSnapshot = () => state;
export const getServerSnapshot = () => LOADING;

export function startOps() {
  if (started) return;
  started = true;
  repo.load().then((data) => {
    state = { status: "ready", data };
    emit();
  });
}

function commit(update: (d: OpsSnapshot) => OpsSnapshot) {
  state = { status: "ready", data: update(state.data) };
  emit();
  void repo.save(state.data);
}

export async function resetOps() {
  state = LOADING;
  emit();
  state = { status: "ready", data: await repo.reset() };
  emit();
}

const fail = (error: string): Result => ({ ok: false, error });
const ok = (id?: string): Result => ({ ok: true, id });
const can = (actor: Actor, a: OpsAction = "ops.write") => opsPermissions[a].includes(actor.role);
const denied = () => fail("Vai trò hiện tại không có quyền thực hiện thao tác này");
const nowTime = () => new Date().toTimeString().slice(0, 5);

const hist = (d: OpsSnapshot, orderId: string, by: string, text: string, refId?: string) => [
  ...d.history,
  { id: nextSeq("LS-", d.history.map((h) => h.id), 6), orderId, refId, at: `${CRM_TODAY}T${nowTime()}`, by, text },
];
const contractOf = (orderId: string) => getCrm().data.contracts.find((c) => c.orderId === orderId);
const upsertOrder = (d: OpsSnapshot, orderId: string, patch: (o: OpsOrder) => OpsOrder): OpsSnapshot["orders"] => {
  const cur =
    d.orders.find((o) => o.orderId === orderId) ??
    ({
      orderId,
      assigneeId: "",
      dueOn: addDays(CRM_TODAY, contractOf(orderId)?.route === "vn" ? 20 : 40),
      handover: { items: Object.fromEntries(handoverItems.map((i) => [i.id, false])), status: "cho-xac-nhan" },
    } as OpsOrder);
  const next = patch(cur);
  return d.orders.some((o) => o.orderId === orderId) ? d.orders.map((o) => (o.orderId === orderId ? next : o)) : [...d.orders, next];
};
const patchPo = (d: OpsSnapshot, poId: string, patch: Partial<PurchaseOrder>) => d.pos.map((p) => (p.poId === poId ? { ...p, ...patch } : p));
const patchShipment = (d: OpsSnapshot, id: string, patch: Partial<Shipment>) => d.shipments.map((s) => (s.shipmentId === id ? { ...s, ...patch } : s));
const staffName = (id: string) => state.data.staff.find((s) => s.id === id)?.name ?? id;

export interface NewSupplierInput {
  name: string;
  country: SupplierCountry;
  city: string;
  categories: string[];
  leadTimeDays: number;
  moq: string;
  contactName: string;
  phone: string;
}
export interface NewSupplierQuoteInput {
  supplierId: string;
  goodsUnitPrice: number;
  freightCost: number;
  handlingFee: number;
  leadTimeDays: number;
  moq: string;
  validUntil: string;
  paymentTerms: string;
  note?: string;
}
export interface NewShipmentInput {
  mode: TransportMode;
  originPoint: string;
  destination: string;
  partnerId: string;
  startOn: string;
  estimated: CostSet;
}

const TRANSIT: Record<TransportMode, number> = { air: 5, "sea-fcl": 20, "sea-lcl": 24 };

export const actions = {
  // ---------- Sourcing ----------
  /** Nhận RFQ đã gửi yêu cầu giá cho Sourcing thành yêu cầu tìm nguồn (không tạo trùng). */
  syncRequests(): void {
    const crm = getCrm().data;
    const known = new Set(state.data.requests.map((r) => r.rfqId));
    const fresh = crm.rfqs.filter((r) => r.priceRequest.sourcing === "cho-gia" && !known.has(r.rfqId));
    if (fresh.length === 0) return;
    commit((d) => {
      let requests = d.requests;
      for (const r of fresh) {
        requests = [
          ...requests,
          {
            requestId: nextSeq("SR-", requests.map((x) => x.requestId), 4),
            rfqId: r.rfqId,
            messId: r.messId,
            customerId: r.customerId,
            route: r.route,
            status: "moi",
            assigneeId: "",
            createdAt: r.priceRequest.sentAt ?? CRM_TODAY,
            dueOn: addDays(r.priceRequest.sentAt ?? CRM_TODAY, 3),
          },
        ];
      }
      return { ...d, requests };
    });
  },

  assignRequest(actor: Actor, requestId: string, assigneeId: string): Result {
    if (!can(actor)) return denied();
    commit((d) => ({
      ...d,
      requests: d.requests.map((r) => (r.requestId === requestId ? { ...r, assigneeId, status: r.status === "moi" ? "dang-tim" : r.status } : r)),
      history: hist(d, "", actor.id, `Phân công yêu cầu ${requestId} cho ${staffName(assigneeId)}`, requestId),
    }));
    return ok(requestId);
  },

  addSupplierQuote(actor: Actor, requestId: string, input: NewSupplierQuoteInput): Result {
    if (!can(actor)) return denied();
    const req = state.data.requests.find((r) => r.requestId === requestId);
    if (!req) return fail("Không tìm thấy yêu cầu");
    if (req.status === "da-chon" || req.status === "huy") return fail("Yêu cầu đã chốt, không thêm báo giá");
    if (state.data.supplierQuotes.some((q) => q.requestId === requestId && q.supplierId === input.supplierId)) return fail("Nhà cung cấp này đã có báo giá cho yêu cầu");
    if (input.goodsUnitPrice <= 0) return fail("Đơn giá hàng phải lớn hơn 0");
    const rfq = getCrm().data.rfqs.find((r) => r.rfqId === req.rfqId);
    let id = "";
    commit((d) => {
      id = nextSeq("SQ-", d.supplierQuotes.map((q) => q.quoteId), 5);
      const quote: SupplierQuote = { quoteId: id, requestId, quantity: rfq?.quantity ?? 1, status: "cho-chon", ...input };
      return {
        ...d,
        supplierQuotes: [...d.supplierQuotes, quote],
        requests: d.requests.map((r) => (r.requestId === requestId ? { ...r, status: "co-bao-gia" } : r)),
        history: hist(d, "", actor.id, `Thêm báo giá ${id} của ${d.suppliers.find((s) => s.supplierId === input.supplierId)?.name ?? input.supplierId}`, requestId),
      };
    });
    return ok(id);
  },

  /** Chọn xưởng, đồng thời trả giá cho Sale bên CRM (RFQ chuyển sang "Đã có giá"). */
  selectQuote(actor: Actor, requestId: string, quoteId: string): Result {
    if (!can(actor)) return denied();
    const req = state.data.requests.find((r) => r.requestId === requestId);
    const quote = state.data.supplierQuotes.find((q) => q.quoteId === quoteId && q.requestId === requestId);
    if (!req || !quote) return fail("Không tìm thấy báo giá");
    if (req.status === "da-chon") return fail("Yêu cầu đã chọn xưởng");
    commit((d) => ({
      ...d,
      requests: d.requests.map((r) => (r.requestId === requestId ? { ...r, status: "da-chon", selectedQuoteId: quoteId } : r)),
      supplierQuotes: d.supplierQuotes.map((q) => (q.requestId !== requestId ? q : { ...q, status: q.quoteId === quoteId ? "da-chon" : "loai" })),
      history: hist(d, "", actor.id, `Chọn báo giá ${quoteId} và trả giá cho Sale (${req.rfqId})`, requestId),
    }));
    crmActions.returnPrices(actor, req.rfqId);
    return ok(requestId);
  },

  cancelRequest(actor: Actor, requestId: string): Result {
    if (!can(actor)) return denied();
    commit((d) => ({ ...d, requests: d.requests.map((r) => (r.requestId === requestId ? { ...r, status: "huy" } : r)), history: hist(d, "", actor.id, `Hủy yêu cầu ${requestId}`, requestId) }));
    return ok(requestId);
  },

  addSupplier(actor: Actor, input: NewSupplierInput): Result {
    if (!can(actor)) return denied();
    let id = "";
    commit((d) => {
      id = nextSeq("NCC-", d.suppliers.map((s) => s.supplierId), 3);
      return { ...d, suppliers: [...d.suppliers, { supplierId: id, rating: 3, onTimeRate: 90, status: "theo-doi", note: "Mới thêm, chưa có đánh giá (dữ liệu demo)", ...input }] };
    });
    return ok(id);
  },

  setSupplierStatus(actor: Actor, supplierId: string, status: SupplierStatus): Result {
    if (!can(actor)) return denied();
    commit((d) => ({ ...d, suppliers: d.suppliers.map((s) => (s.supplierId === supplierId ? { ...s, status } : s)) }));
    return ok(supplierId);
  },

  // ---------- Đơn hàng: bàn giao ----------
  /** Vận hành xác nhận bàn giao: nhận khi đủ mục, thiếu thì trả lại Sale kèm lý do. Chỉ nhận khi Kế toán đã xác nhận cọc. */
  reviewHandover(actor: Actor, orderId: string, items: Record<string, boolean>, decision: "accept" | "return", note: string): Result {
    if (!can(actor)) return denied();
    const contract = contractOf(orderId);
    if (!contract) return fail("Không tìm thấy hợp đồng");
    if (decision === "accept") {
      if (contract.deposit.status !== "da-coc") return fail("Chưa có xác nhận Đã cọc của Kế toán, chưa nhận bàn giao");
      const missing = handoverItems.filter((i) => !items[i.id]);
      if (missing.length) return fail(`Còn thiếu: ${missing.map((m) => m.label).join(", ")}. Trả lại Sale thay vì nhận.`);
    } else if (!note.trim()) return fail("Trả lại Sale cần ghi rõ thiếu gì");
    commit((d) => ({
      ...d,
      orders: upsertOrder(d, orderId, (o) => ({
        ...o,
        assigneeId: o.assigneeId || actor.id,
        handover: { items, status: decision === "accept" ? "da-nhan" : "tra-lai", note: decision === "return" ? note.trim() : undefined, reviewedAt: CRM_TODAY, reviewedBy: actor.id },
      })),
      history: hist(d, orderId, actor.id, decision === "accept" ? "Vận hành xác nhận bàn giao đủ thông tin" : `Trả lại Sale: ${note.trim()}`),
    }));
    return ok(orderId);
  },

  saveHandoverItems(actor: Actor, orderId: string, items: Record<string, boolean>): Result {
    if (!can(actor)) return denied();
    commit((d) => ({ ...d, orders: upsertOrder(d, orderId, (o) => ({ ...o, handover: { ...o.handover, items } })) }));
    return ok(orderId);
  },

  assignOrder(actor: Actor, orderId: string, assigneeId: string): Result {
    if (!can(actor)) return denied();
    commit((d) => ({ ...d, orders: upsertOrder(d, orderId, (o) => ({ ...o, assigneeId })), history: hist(d, orderId, actor.id, `Phân công phụ trách: ${staffName(assigneeId)}`) }));
    return ok(orderId);
  },

  addOrderNote(actor: Actor, orderId: string, text: string): Result {
    if (!can(actor)) return denied();
    if (!text.trim()) return fail("Nội dung ghi chú trống");
    commit((d) => ({ ...d, history: hist(d, orderId, actor.id, `Ghi chú: ${text.trim()}`) }));
    return ok(orderId);
  },

  // ---------- PO ----------
  /** Tạo PO nháp từ báo giá xưởng đã chọn. Cổng: đã cọc và đã nhận bàn giao. */
  createPo(actor: Actor, orderId: string): Result {
    if (!can(actor)) return denied();
    const contract = contractOf(orderId);
    const order = state.data.orders.find((o) => o.orderId === orderId);
    const gate = canPlacePo(contract, order);
    if (!gate.ok) return fail(gate.reason ?? "Chưa đủ điều kiện");
    if (state.data.pos.some((p) => p.orderId === orderId && p.status !== "huy")) return fail("Đơn đã có PO");
    const req = state.data.requests.find((r) => r.rfqId === contract!.rfqId);
    const quote = state.data.supplierQuotes.find((q) => q.quoteId === req?.selectedQuoteId);
    if (!req || !quote) return fail("Chưa chọn xưởng ở bước Sourcing (cần chọn một báo giá nhà cung cấp)");
    let id = "";
    commit((d) => {
      id = nextSeq("PO-", d.pos.map((p) => p.poId), 4);
      const po: PurchaseOrder = {
        poId: id,
        orderId,
        requestId: req.requestId,
        supplierId: quote.supplierId,
        quoteId: quote.quoteId,
        status: "nhap",
        amount: quote.goodsUnitPrice * quote.quantity,
        createdAt: CRM_TODAY,
        expectedReadyOn: addDays(CRM_TODAY, quote.leadTimeDays),
        qc: Object.fromEntries(qcItems.map((q) => [q.id, { result: "cho" as QcResult }])),
        assigneeId: order?.assigneeId || actor.id,
      };
      return { ...d, pos: [...d.pos, po], history: hist(d, orderId, actor.id, `Tạo PO ${id}`, id) };
    });
    return ok(id);
  },

  /** Đặt xưởng. Kiểm lại cổng "Đã cọc" ngay lúc đặt (dữ liệu cọc có thể đã đổi). */
  placePo(actor: Actor, poId: string): Result {
    if (!can(actor)) return denied();
    const po = state.data.pos.find((p) => p.poId === poId);
    if (!po || po.status !== "nhap") return fail("PO không ở trạng thái nháp");
    const gate = canPlacePo(contractOf(po.orderId), state.data.orders.find((o) => o.orderId === po.orderId));
    if (!gate.ok) return fail(gate.reason ?? "Chưa đủ điều kiện");
    const quote = state.data.supplierQuotes.find((q) => q.quoteId === po.quoteId);
    commit((d) => ({
      ...d,
      pos: patchPo(d, poId, { status: "da-gui", placedAt: CRM_TODAY, expectedReadyOn: addDays(CRM_TODAY, quote?.leadTimeDays ?? 20) }),
      history: hist(d, po.orderId, actor.id, `Đặt xưởng ${poId}`, poId),
    }));
    return ok(poId);
  },

  advancePo(actor: Actor, poId: string): Result {
    if (!can(actor)) return denied();
    const po = state.data.pos.find((p) => p.poId === poId);
    if (!po) return fail("Không tìm thấy PO");
    const idx = poFlow.indexOf(po.status);
    if (po.status === "huy" || idx < 1 || idx >= poFlow.length - 1) return fail("PO không thể chuyển bước tiếp");
    const gate = canPlacePo(contractOf(po.orderId), state.data.orders.find((o) => o.orderId === po.orderId));
    if (!gate.ok) return fail(gate.reason ?? "Chưa đủ điều kiện");
    const next = poFlow[idx + 1];
    if (next === "san-sang" && !canAdvanceToReady(po)) return fail("QC chưa hoàn tất: mọi mục phải Đạt hoặc Không áp dụng trước khi báo hàng sẵn sàng");
    commit((d) => ({ ...d, pos: patchPo(d, poId, { status: next }), history: hist(d, po.orderId, actor.id, `PO ${poId} chuyển sang: ${next}`, poId) }));
    return ok(poId);
  },

  setQc(actor: Actor, poId: string, itemId: string, result: QcResult, note: string): Result {
    if (!can(actor)) return denied();
    const po = state.data.pos.find((p) => p.poId === poId);
    if (!po) return fail("Không tìm thấy PO");
    if (po.status !== "dang-san-xuat" && po.status !== "qc") return fail("QC chỉ ghi khi PO đang sản xuất hoặc đang QC");
    if (result === "khong-dat" && !note.trim()) return fail("QC không đạt cần ghi chú lý do");
    commit((d) => ({
      ...d,
      pos: patchPo(d, poId, { qc: { ...po.qc, [itemId]: { result, note: note.trim() || undefined } } }),
      history: hist(d, po.orderId, actor.id, `QC ${poId} – ${qcItems.find((q) => q.id === itemId)?.label}: ${result}${note.trim() ? ` (${note.trim()})` : ""}`, poId),
    }));
    return ok(poId);
  },

  cancelPo(actor: Actor, poId: string): Result {
    if (!can(actor)) return denied();
    const po = state.data.pos.find((p) => p.poId === poId);
    if (!po || po.status === "da-giao-vc" || po.status === "huy") return fail("Không thể hủy PO ở trạng thái này");
    commit((d) => ({ ...d, pos: patchPo(d, poId, { status: "huy" }), history: hist(d, po.orderId, actor.id, `Hủy PO ${poId}`, poId) }));
    return ok(poId);
  },

  // ---------- Logistics ----------
  createShipment(actor: Actor, orderId: string, input: NewShipmentInput): Result {
    if (!can(actor)) return denied();
    const po = state.data.pos.find((p) => p.orderId === orderId && p.status !== "huy");
    const gate = canPlacePo(contractOf(orderId), state.data.orders.find((o) => o.orderId === orderId));
    if (!gate.ok) return fail(gate.reason ?? "Chưa đủ điều kiện");
    if (!po || (po.status !== "san-sang" && po.status !== "da-giao-vc")) return fail("PO phải ở trạng thái Hàng sẵn sàng trước khi tạo lô hàng");
    if (!input.originPoint.trim() || !input.destination.trim()) return fail("Nhập điểm đi và điểm đến");
    const gaps = [0, 2, 3, TRANSIT[input.mode], 2, 3];
    let acc = 0;
    const ms = Object.fromEntries(milestones.map((m, i) => [m.key, { plannedOn: addDays(input.startOn, (acc += gaps[i])) }])) as Shipment["milestones"];
    let id = "";
    commit((d) => {
      id = nextSeq("LH-", d.shipments.map((s) => s.shipmentId), 4);
      const shipment: Shipment = {
        shipmentId: id,
        orderId,
        mode: input.mode,
        originPoint: input.originPoint.trim(),
        destination: input.destination.trim(),
        partnerId: input.partnerId,
        etd: ms.dispatch.plannedOn,
        eta: ms.arrive.plannedOn,
        milestones: ms,
        costs: { estimated: input.estimated },
        trackingRef: `DEMO-${id.slice(3)}`,
        assigneeId: actor.id,
      };
      const ids = d.documents.map((x) => x.docId);
      const docs = requiredDocs(input.mode).map((type) => {
        const docId = nextSeq("CT-", ids, 5);
        ids.push(docId);
        return { docId, shipmentId: id, orderId, type, status: "thieu" as const, updatedAt: CRM_TODAY };
      });
      return { ...d, shipments: [...d.shipments, shipment], documents: [...d.documents, ...docs], history: hist(d, orderId, actor.id, `Tạo lô hàng ${id}`, id) };
    });
    return ok(id);
  },

  /** Hoàn thành mốc theo thứ tự (không nhảy cóc), ngày thực tế không ở tương lai. Tự thêm sự kiện tracking nhập tay. */
  completeMilestone(actor: Actor, shipmentId: string, key: MilestoneKey, date: string): Result {
    if (!can(actor)) return denied();
    const s = state.data.shipments.find((x) => x.shipmentId === shipmentId);
    if (!s) return fail("Không tìm thấy lô hàng");
    const next = nextMilestone(s);
    if (!next || next.key !== key) return fail(`Phải hoàn thành tuần tự, mốc tiếp theo là: ${next?.label ?? "không còn mốc"}`);
    if (date > CRM_TODAY) return fail("Ngày thực tế không được ở tương lai");
    const label = milestones.find((m) => m.key === key)!.label;
    commit((d) => ({
      ...d,
      shipments: patchShipment(d, shipmentId, { milestones: { ...s.milestones, [key]: { ...s.milestones[key], actualOn: date } } }),
      trackingEvents: [...d.trackingEvents, { id: nextSeq("TK-", d.trackingEvents.map((t) => t.id), 6), shipmentId, at: `${date}T${nowTime()}`, location: label, text: `Hoàn thành mốc: ${label}`, source: "manual" }],
      history: hist(d, s.orderId, actor.id, `Lô ${shipmentId} hoàn thành mốc ${label} (${date})`, shipmentId),
    }));
    return ok(shipmentId);
  },

  addTrackingEvent(actor: Actor, shipmentId: string, location: string, text: string): Result {
    if (!can(actor)) return denied();
    if (!text.trim()) return fail("Nhập nội dung sự kiện");
    commit((d) => ({ ...d, trackingEvents: [...d.trackingEvents, { id: nextSeq("TK-", d.trackingEvents.map((t) => t.id), 6), shipmentId, at: `${CRM_TODAY}T${nowTime()}`, location: location.trim() || "—", text: text.trim(), source: "manual" }] }));
    return ok(shipmentId);
  },

  saveActualCosts(actor: Actor, shipmentId: string, actual: CostSet): Result {
    if (!can(actor)) return denied();
    const s = state.data.shipments.find((x) => x.shipmentId === shipmentId);
    if (!s) return fail("Không tìm thấy lô hàng");
    if (Object.values(actual).some((v) => v < 0)) return fail("Chi phí không được âm");
    commit((d) => ({ ...d, shipments: patchShipment(d, shipmentId, { costs: { ...s.costs, actual } }), history: hist(d, s.orderId, actor.id, `Cập nhật chi phí thực tế lô ${shipmentId}`, shipmentId) }));
    return ok(shipmentId);
  },

  // ---------- Chứng từ ----------
  /** Mô phỏng tải chứng từ: chỉ ghi tên file, không lưu tệp. */
  addDocument(actor: Actor, shipmentId: string, type: DocType, fileName: string): Result {
    if (!can(actor)) return denied();
    const s = state.data.shipments.find((x) => x.shipmentId === shipmentId);
    if (!s) return fail("Không tìm thấy lô hàng");
    if (!fileName.trim()) return fail("Nhập tên file chứng từ");
    commit((d) => {
      const existing = d.documents.find((x) => x.shipmentId === shipmentId && x.type === type);
      if (existing) {
        return { ...d, documents: d.documents.map((x) => (x.docId === existing.docId ? { ...x, status: "cho-duyet", fileName: fileName.trim(), updatedAt: CRM_TODAY, note: undefined } : x)), history: hist(d, s.orderId, actor.id, `Tải chứng từ ${type} lô ${shipmentId}`, shipmentId) };
      }
      return { ...d, documents: [...d.documents, { docId: nextSeq("CT-", d.documents.map((x) => x.docId), 5), shipmentId, orderId: s.orderId, type, status: "cho-duyet", fileName: fileName.trim(), updatedAt: CRM_TODAY }], history: hist(d, s.orderId, actor.id, `Tải chứng từ ${type} lô ${shipmentId}`, shipmentId) };
    });
    return ok(shipmentId);
  },

  reviewDocument(actor: Actor, docId: string, approve: boolean, note: string): Result {
    if (!can(actor)) return denied();
    const doc = state.data.documents.find((x) => x.docId === docId);
    if (!doc || doc.status !== "cho-duyet") return fail("Chứng từ không chờ duyệt");
    if (!approve && !note.trim()) return fail("Từ chối cần ghi lý do");
    commit((d) => ({
      ...d,
      documents: d.documents.map((x) => (x.docId === docId ? { ...x, status: approve ? "da-duyet" : "tu-choi", note: note.trim() || undefined, updatedAt: CRM_TODAY } : x)),
      history: hist(d, doc.orderId, actor.id, `${approve ? "Duyệt" : "Từ chối"} chứng từ ${doc.type} lô ${doc.shipmentId}${note.trim() ? `: ${note.trim()}` : ""}`, doc.shipmentId),
    }));
    return ok(docId);
  },
};

export type OpsActions = typeof actions;

import { CRM_TODAY } from "@/config/crm";
import { fulfillmentPermissions, type FulfillmentAction } from "@/config/fulfillment";
import { getSnapshot as getCrm, type Actor, type Result } from "@/features/crm/store";
import { actions as opsActions, getSnapshot as getOps } from "@/features/operations/store";
import { localFulfillmentRepository } from "@/services/fulfillment/repository";
import { allPicked, canCreateOutbound, nextSeq, packBlockReason, podOutcome, receiptOutcome } from "@/services/fulfillment/rules";
import { createStore } from "@/services/store-factory";
import type { FulfillmentSnapshot, Package } from "@/types/fulfillment";

/**
 * Store Fulfillment. Đọc đơn/hợp đồng từ CRM, lô hàng từ Vận hành; xác nhận giao hàng (POD) ghi ngược mốc "Giao hàng"
 * của lô hàng bên Vận hành để hai module luôn khớp trạng thái.
 */
const empty: FulfillmentSnapshot = { warehouses: [], receipts: [], packages: [], outbounds: [], deliveries: [], inquiries: [] };
const store = createStore(localFulfillmentRepository, empty);
export const { subscribe, getSnapshot, getServerSnapshot } = store;
export const startFulfillment = store.start;
export const resetFulfillment = store.reset;
const { commit } = store;
const state = () => store.getSnapshot().data;

const fail = (error: string): Result => ({ ok: false, error });
const ok = (id?: string): Result => ({ ok: true, id });
const can = (actor: Actor, a: FulfillmentAction = "wh.write") => fulfillmentPermissions[a].includes(actor.role);
const denied = () => fail("Vai trò hiện tại không có quyền thực hiện thao tác này");
const LOCATION = /^[A-Z]-\d{2}-\d{2}$/;
const patchPkgs = (d: FulfillmentSnapshot, ids: string[], status: Package["status"]) => d.packages.map((p) => (ids.includes(p.packageId) ? { ...p, status } : p));

export const actions = {
  /** Đề xuất UI: phân bổ số lượng từng lô nhập tay, chưa tự chia số lượng của đơn nhiều lô. */
  createInbound(actor: Actor, shipmentId: string, warehouseId: string, expectedQty: number): Result {
    if (!can(actor)) return denied();
    const shipment = getOps().data.shipments.find((s) => s.shipmentId === shipmentId);
    if (!shipment?.milestones.arrive.actualOn || shipment.milestones.deliver.actualOn) return fail("Lô phải đã về kho và chưa hoàn tất giao hàng");
    if (state().receipts.some((r) => r.shipmentId === shipmentId)) return fail("Lô hàng đã có phiếu nhập");
    if (!state().warehouses.some((w) => w.warehouseId === warehouseId)) return fail("Kho không tồn tại");
    if (!Number.isSafeInteger(expectedQty) || expectedQty <= 0) return fail("Nhập số lượng dự kiến nguyên dương");
    let id = "";
    commit((d) => {
      id = nextSeq("NK-", d.receipts.map((r) => r.receiptId), 4);
      return { ...d, receipts: [...d.receipts, { receiptId: id, shipmentId, orderId: shipment.orderId, warehouseId, arrivedOn: shipment.milestones.arrive.actualOn!, status: "cho-nhap", expectedQty, receivedQty: 0 }] };
    });
    return ok(id);
  },
  // ---------- Nhập kho ----------
  /** Kiểm đếm và nhập kho một lô hàng đã về. Lệch số lượng phải ghi chú. Tạo kiện hàng với vị trí lưu kho. */
  receiveInbound(actor: Actor, receiptId: string, receivedQty: number, weightKg: number, location: string, note: string): Result {
    if (!can(actor)) return denied();
    const r = state().receipts.find((x) => x.receiptId === receiptId);
    if (!r || r.status !== "cho-nhap") return fail("Phiếu không ở trạng thái chờ nhập kho");
    const out = receiptOutcome(r.expectedQty, receivedQty, note);
    if (!out.ok) return fail(out.error);
    if (receivedQty <= 0) return fail("Số lượng nhận phải lớn hơn 0");
    if (!LOCATION.test(location)) return fail("Vị trí lưu kho theo dạng khu-hàng-kệ, ví dụ A-03-12");
    if (!(weightKg > 0)) return fail("Nhập tổng trọng lượng kiện (kg)");
    const rfq = getCrm().data.rfqs.find((x) => x.rfqId === getCrm().data.contracts.find((c) => c.orderId === r.orderId)?.rfqId);
    commit((d) => {
      const pkg: Package = {
        packageId: nextSeq("PK-", d.packages.map((p) => p.packageId), 6),
        orderId: r.orderId,
        receiptId,
        warehouseId: r.warehouseId,
        sku: `SKU-${r.orderId.slice(-4)}-1`,
        description: rfq?.goodsName ?? "Hàng hóa",
        quantity: receivedQty,
        weightKg,
        location,
        status: "trong-kho",
      };
      return {
        ...d,
        receipts: d.receipts.map((x) => (x.receiptId === receiptId ? { ...x, status: out.status, receivedQty, receivedAt: CRM_TODAY, receivedBy: actor.id, note: note.trim() || undefined } : x)),
        packages: [...d.packages, pkg],
      };
    });
    return ok(receiptId);
  },

  movePackage(actor: Actor, packageId: string, location: string): Result {
    if (!can(actor)) return denied();
    const p = state().packages.find((x) => x.packageId === packageId);
    if (!p) return fail("Không tìm thấy kiện hàng");
    if (p.status === "da-xuat" || p.status === "da-giao") return fail("Kiện đã xuất kho, không đổi vị trí");
    if (!LOCATION.test(location)) return fail("Vị trí lưu kho theo dạng khu-hàng-kệ, ví dụ A-03-12");
    commit((d) => ({ ...d, packages: d.packages.map((x) => (x.packageId === packageId ? { ...x, location } : x)) }));
    return ok(packageId);
  },

  // ---------- Pick / Pack ----------
  createOutbound(actor: Actor, orderId: string): Result {
    if (!can(actor)) return denied();
    const gate = canCreateOutbound(orderId, state());
    if (!gate.ok) return fail(gate.reason ?? "Chưa đủ điều kiện");
    const pkgs = state().packages.filter((p) => p.orderId === orderId);
    let id = "";
    commit((d) => {
      id = nextSeq("OB-", d.outbounds.map((o) => o.outboundId), 4);
      return {
        ...d,
        outbounds: [...d.outbounds, { outboundId: id, orderId, warehouseId: pkgs[0].warehouseId, packageIds: pkgs.map((p) => p.packageId), pickedIds: [], status: "cho-pick", createdAt: CRM_TODAY, assigneeId: actor.id }],
        packages: patchPkgs(d, pkgs.map((p) => p.packageId), "da-giu-cho"),
      };
    });
    return ok(id);
  },

  pickPackage(actor: Actor, outboundId: string, packageId: string): Result {
    if (!can(actor)) return denied();
    const o = state().outbounds.find((x) => x.outboundId === outboundId);
    if (!o || (o.status !== "cho-pick" && o.status !== "dang-pick")) return fail("Lệnh không ở bước pick");
    if (!o.packageIds.includes(packageId)) return fail("Kiện không thuộc lệnh này");
    if (o.pickedIds.includes(packageId)) return fail("Kiện đã pick");
    commit((d) => {
      const picked = [...o.pickedIds, packageId];
      const done = o.packageIds.every((id) => picked.includes(id));
      return {
        ...d,
        outbounds: d.outbounds.map((x) => (x.outboundId === outboundId ? { ...x, pickedIds: picked, status: done ? "da-pick" : "dang-pick" } : x)),
        packages: patchPkgs(d, [packageId], "da-pick"),
      };
    });
    return ok(outboundId);
  },

  packOutbound(actor: Actor, outboundId: string, weightKg: number, boxes: number): Result {
    if (!can(actor)) return denied();
    const o = state().outbounds.find((x) => x.outboundId === outboundId);
    if (!o) return fail("Không tìm thấy lệnh");
    const block = packBlockReason(o);
    if (block) return fail(block);
    if (!(weightKg > 0) || !(boxes >= 1)) return fail("Nhập trọng lượng và số thùng hợp lệ");
    commit((d) => ({
      ...d,
      outbounds: d.outbounds.map((x) => (x.outboundId === outboundId ? { ...x, status: "da-dong-goi", packed: { weightKg, boxes, packedAt: CRM_TODAY, packedBy: actor.id } } : x)),
      packages: patchPkgs(d, o.packageIds, "da-dong-goi"),
    }));
    return ok(outboundId);
  },

  // ---------- Giao chặng cuối / POD ----------
  dispatchDelivery(actor: Actor, outboundId: string, carrier: string): Result {
    if (!can(actor)) return denied();
    const o = state().outbounds.find((x) => x.outboundId === outboundId);
    if (!o || o.status !== "da-dong-goi") return fail("Chỉ giao khi lệnh đã đóng gói");
    if (!allPicked(o)) return fail("Lệnh chưa pick đủ");
    if (!carrier.trim()) return fail("Chọn đơn vị giao chặng cuối");
    const contract = getCrm().data.contracts.find((c) => c.orderId === o.orderId);
    const customer = getCrm().data.customers.find((c) => c.customerId === contract?.customerId);
    const rfq = getCrm().data.rfqs.find((r) => r.rfqId === contract?.rfqId);
    let id = "";
    commit((d) => {
      id = nextSeq("DL-", d.deliveries.map((x) => x.deliveryId), 4);
      return {
        ...d,
        deliveries: [...d.deliveries, { deliveryId: id, outboundId, orderId: o.orderId, carrier: carrier.trim(), recipientName: customer?.contactName ?? "", address: rfq?.destination ?? "", trackingRef: `DEMO-GN-${id.slice(3)}`, status: "dang-giao", dispatchedAt: CRM_TODAY }],
        outbounds: d.outbounds.map((x) => (x.outboundId === outboundId ? { ...x, status: "da-xuat" } : x)),
        packages: patchPkgs(d, o.packageIds, "da-xuat"),
      };
    });
    return ok(id);
  },

  /** Xác nhận đã giao (POD). Ghi ngược mốc "Giao hàng" của lô hàng bên Vận hành để hai module khớp nhau. */
  confirmPod(actor: Actor, deliveryId: string, receivedBy: string, note: string, evidenceFile: string): Result {
    if (!can(actor)) return denied();
    const dl = state().deliveries.find((x) => x.deliveryId === deliveryId);
    if (!dl || dl.status !== "dang-giao") return fail("Chỉ xác nhận POD cho lần giao đang giao");
    const pod = podOutcome(receivedBy, note);
    if (!pod.ok) return fail(pod.error ?? "Thiếu thông tin POD");
    const o = state().outbounds.find((x) => x.outboundId === dl.outboundId);
    commit((d) => ({
      ...d,
      deliveries: d.deliveries.map((x) => (x.deliveryId === deliveryId ? { ...x, status: "da-giao", deliveredAt: CRM_TODAY, failureReason: undefined, pod: { receivedBy: receivedBy.trim(), signedOn: CRM_TODAY, note: note.trim(), evidenceFile: evidenceFile.trim() || `POD-${deliveryId}.jpg` } } : x)),
      packages: patchPkgs(d, o?.packageIds ?? [], "da-giao"),
    }));
    const packageIds = new Set(o?.packageIds ?? []);
    const receiptIds = new Set(state().packages.filter((p) => packageIds.has(p.packageId)).map((p) => p.receiptId));
    const shipmentIds = new Set(state().receipts.filter((r) => receiptIds.has(r.receiptId)).map((r) => r.shipmentId));
    for (const shipmentId of shipmentIds) {
      const receipts = state().receipts.filter((r) => r.shipmentId === shipmentId);
      const ids = new Set(receipts.map((r) => r.receiptId));
      const packages = state().packages.filter((p) => ids.has(p.receiptId));
      const ship = getOps().data.shipments.find((s) => s.shipmentId === shipmentId);
      if (ship?.milestones.arrive.actualOn && !ship.milestones.deliver.actualOn && receipts.every((r) => r.status !== "cho-nhap") && packages.length > 0 && packages.every((p) => p.status === "da-giao")) {
        opsActions.completeMilestone(actor, shipmentId, "deliver", CRM_TODAY);
      }
    }
    return ok(deliveryId);
  },

  failDelivery(actor: Actor, deliveryId: string, reason: string): Result {
    if (!can(actor)) return denied();
    const dl = state().deliveries.find((x) => x.deliveryId === deliveryId);
    if (!dl || dl.status !== "dang-giao") return fail("Lần giao không ở trạng thái đang giao");
    if (!reason.trim()) return fail("Nhập lý do giao không thành");
    commit((d) => ({ ...d, deliveries: d.deliveries.map((x) => (x.deliveryId === deliveryId ? { ...x, status: "giao-that-bai", failureReason: reason.trim() } : x)) }));
    return ok(deliveryId);
  },

  redispatch(actor: Actor, deliveryId: string): Result {
    if (!can(actor)) return denied();
    const dl = state().deliveries.find((x) => x.deliveryId === deliveryId);
    if (!dl || dl.status !== "giao-that-bai") return fail("Chỉ giao lại khi lần trước không thành");
    commit((d) => ({ ...d, deliveries: d.deliveries.map((x) => (x.deliveryId === deliveryId ? { ...x, status: "dang-giao", dispatchedAt: CRM_TODAY, failureReason: undefined } : x)) }));
    return ok(deliveryId);
  },

  // ---------- Hỏi tình trạng đơn (từ Sale) ----------
  createInquiry(actor: Actor, orderId: string, question: string, priority: "cao" | "thuong"): Result {
    if (!can(actor, "inquiry.create")) return denied();
    if (!question.trim()) return fail("Nhập câu hỏi cho Fulfillment");
    const c = getCrm().data.contracts.find((x) => x.orderId === orderId);
    if (!c) return fail("Không tìm thấy đơn hàng");
    let id = "";
    commit((d) => {
      id = nextSeq("HQ-", d.inquiries.map((i) => i.inquiryId), 4);
      return { ...d, inquiries: [...d.inquiries, { inquiryId: id, orderId, messId: c.messId, askedBy: actor.id, askedAt: CRM_TODAY, question: question.trim(), priority, status: "moi" }] };
    });
    return ok(id);
  },

  takeInquiry(actor: Actor, inquiryId: string): Result {
    if (!can(actor)) return denied();
    const q = state().inquiries.find((x) => x.inquiryId === inquiryId);
    if (!q || q.status !== "moi") return fail("Yêu cầu không ở trạng thái chưa xử lý");
    commit((d) => ({ ...d, inquiries: d.inquiries.map((x) => (x.inquiryId === inquiryId ? { ...x, status: "dang-xu-ly", assigneeId: actor.id } : x)) }));
    return ok(inquiryId);
  },

  answerInquiry(actor: Actor, inquiryId: string, answer: string): Result {
    if (!can(actor)) return denied();
    const q = state().inquiries.find((x) => x.inquiryId === inquiryId);
    if (!q || q.status === "da-tra-loi") return fail("Yêu cầu đã được trả lời");
    if (!answer.trim()) return fail("Nhập nội dung trả lời");
    commit((d) => ({ ...d, inquiries: d.inquiries.map((x) => (x.inquiryId === inquiryId ? { ...x, status: "da-tra-loi", answer: answer.trim(), answeredBy: actor.id, answeredAt: CRM_TODAY, assigneeId: x.assigneeId ?? actor.id } : x)) }));
    return ok(inquiryId);
  },
};

export type FulfillmentActions = typeof actions;

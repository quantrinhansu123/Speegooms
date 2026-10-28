import { CRM_TODAY, crmPermissions, simulatedApprovals, type CrmAction } from "@/config/crm";
import { opsPermissions } from "@/config/operations";
import { localCrmRepository } from "@/services/crm/repository";
import {
  canHandOver,
  canMoveToHot,
  canRequestDeposit,
  contractNeedsBoard,
  makeMessId,
  nextId,
  profileCompleteness,
  quoteNeedsApproval,
  quoteTotals,
} from "@/services/crm/rules";
import type { Role } from "@/types/role";
import type {
  CareStatus,
  Contract,
  CrmSnapshot,
  DepositChannel,
  GoodsOrigin,
  Interaction,
  InteractionType,
  Lead,
  LeadSource,
  LostReason,
  Quotation,
  QuoteLine,
  Rfq,
  Temperature,
  Customer,
} from "@/types/crm";

/**
 * Store CRM (external store) dùng chung cho mọi màn hình. Dữ liệu đi qua CrmRepository
 * (hiện là mock localStorage). Mỗi thao tác kiểm quyền, kiểm luật nghiệp vụ và ghi lịch sử.
 */
export interface Actor {
  id: string;
  role: Role;
}
export type Result<T = undefined> = { ok: true; id?: string; data?: T } | { ok: false; error: string };

export interface CrmState {
  status: "loading" | "ready";
  data: CrmSnapshot;
}

const empty: CrmSnapshot = { staff: [], customers: [], leads: [], interactions: [], rfqs: [], quotations: [], contracts: [] };
const LOADING: CrmState = { status: "loading", data: empty };

let state: CrmState = LOADING;
let started = false;
const listeners = new Set<() => void>();
const repo = localCrmRepository;

const emit = () => listeners.forEach((l) => l());
export const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const getSnapshot = () => state;
export const getServerSnapshot = () => LOADING;

export function startCrm() {
  if (started) return;
  started = true;
  repo.load().then((data) => {
    state = { status: "ready", data };
    emit();
  });
}

function commit(update: (d: CrmSnapshot) => CrmSnapshot) {
  state = { status: "ready", data: update(state.data) };
  emit();
  void repo.save(state.data);
}

export async function resetCrm() {
  state = LOADING;
  emit();
  state = { status: "ready", data: await repo.reset() };
  emit();
}

const fail = (error: string): Result => ({ ok: false, error });
const ok = (id?: string): Result => ({ ok: true, id });
const can = (actor: Actor, action: CrmAction) => crmPermissions[action].includes(actor.role);
const denied = () => fail("Vai trò hiện tại không có quyền thực hiện thao tác này");
const nowTime = () => new Date().toTimeString().slice(0, 5);

const log = (d: CrmSnapshot, messId: string, type: InteractionType, content: string, by: string): Interaction[] => [
  ...d.interactions,
  { id: nextId("TT-", d.interactions.map((i) => i.id), 6), messId, type, content, at: `${CRM_TODAY}T${nowTime()}`, by },
];

const patchLead = (d: CrmSnapshot, messId: string, patch: Partial<Lead>) =>
  d.leads.map((l) => (l.messId === messId ? { ...l, ...patch } : l));
const patchRfq = (d: CrmSnapshot, rfqId: string, patch: Partial<Rfq>) =>
  d.rfqs.map((r) => (r.rfqId === rfqId ? { ...r, ...patch } : r));
const patchQuote = (d: CrmSnapshot, quoteId: string, patch: Partial<Quotation>) =>
  d.quotations.map((q) => (q.quoteId === quoteId ? { ...q, ...patch } : q));
const patchContract = (d: CrmSnapshot, orderId: string, patch: Partial<Contract>) =>
  d.contracts.map((c) => (c.orderId === orderId ? { ...c, ...patch } : c));

export interface NewLeadInput {
  contactName: string;
  company: string;
  phone: string;
  email: string;
  source: LeadSource;
  goodsOrigin: GoodsOrigin;
  ownerId: string;
  needSummary: string;
  /** Dùng khách hàng đã có (khi cảnh báo trùng) thay vì tạo mới */
  customerId?: string;
}

export interface NewRfqInput {
  goodsName: string;
  quantity: number;
  unit: string;
  originPoint: string;
  destination: string;
  transportMode: Rfq["transportMode"];
  targetDate: string;
  specialRequirements: string;
  sensitiveGoods: boolean;
}

export interface DepositRequestInput {
  amount: number;
  channel: DepositChannel;
  billRef: string;
  note: string;
}

export const actions = {
  // ---------- Lead ----------
  createLead(actor: Actor, input: NewLeadInput): Result {
    if (!can(actor, "lead.write")) return denied();
    let id = "";
    commit((d) => {
      const messId = makeMessId(CRM_TODAY, input.contactName, d.leads.map((l) => l.messId));
      id = messId;
      let customers = d.customers;
      let customerId = input.customerId;
      if (!customerId) {
        customerId = nextId("KH-", d.customers.map((c) => c.customerId), 3);
        const customer: Customer = {
          customerId,
          name: input.company || input.contactName,
          contactName: input.contactName,
          phone: input.phone,
          email: input.email,
          country: input.goodsOrigin === "cn" ? "Hoa Kỳ" : "Việt Nam",
          route: input.goodsOrigin === "cn" ? "global" : "vn",
          type: input.company ? "doanh-nghiep" : "ca-nhan",
          createdAt: CRM_TODAY,
          ownerId: input.ownerId,
        };
        customers = [...d.customers, customer];
      }
      const known = d.customers.find((c) => c.customerId === customerId);
      const lead: Lead = {
        messId,
        customerId,
        contactName: input.contactName,
        company: input.company || known?.name || input.contactName,
        phone: input.phone,
        email: input.email,
        createdAt: CRM_TODAY,
        source: input.source,
        goodsOrigin: input.goodsOrigin,
        temperature: "cold",
        careStatus: "moi",
        ownerId: input.ownerId,
        needSummary: input.needSummary,
        profile: {},
      };
      return {
        ...d,
        customers,
        leads: [lead, ...d.leads],
        interactions: log(d, messId, "system", "Tạo lead mới", actor.id),
      };
    });
    return ok(id);
  },

  updateLead(actor: Actor, messId: string, patch: Partial<Lead>): Result {
    if (!can(actor, "lead.write")) return denied();
    commit((d) => ({ ...d, leads: patchLead(d, messId, patch) }));
    return ok(messId);
  },

  /** Hot yêu cầu đủ 6 thông tin theo cấu hình (xem rules.canMoveToHot). */
  setTemperature(actor: Actor, messId: string, temperature: Temperature): Result {
    if (!can(actor, "lead.write")) return denied();
    const lead = state.data.leads.find((l) => l.messId === messId);
    if (!lead) return fail("Không tìm thấy lead");
    if (lead.careStatus === "mat") return fail("Lead đã mất khách, mở lại trước khi đổi phân loại");
    if (temperature === "hot") {
      const check = canMoveToHot(lead);
      if (!check.ok) return fail(check.reason ?? "Chưa đủ thông tin để chuyển Hot");
    }
    commit((d) => ({
      ...d,
      leads: patchLead(d, messId, { temperature }),
      interactions: log(d, messId, "system", `Phân loại ${temperature.toUpperCase()}`, actor.id),
    }));
    return ok(messId);
  },

  assignOwner(actor: Actor, messId: string, ownerId: string): Result {
    if (!can(actor, "lead.write")) return denied();
    commit((d) => {
      const name = d.staff.find((s) => s.id === ownerId)?.name ?? ownerId;
      return {
        ...d,
        leads: patchLead(d, messId, { ownerId }),
        interactions: log(d, messId, "system", `Phân công cho ${name}`, actor.id),
      };
    });
    return ok(messId);
  },

  /** Mất khách bắt buộc có lý do; chọn "Khác" thì phải ghi chú. */
  markLost(actor: Actor, messId: string, reason: LostReason | undefined, note: string): Result {
    if (!can(actor, "lead.write")) return denied();
    if (!reason) return fail("Vui lòng chọn lý do mất khách");
    if (reason === "khac" && !note.trim()) return fail("Chọn lý do Khác thì phải nhập ghi chú");
    commit((d) => ({
      ...d,
      leads: patchLead(d, messId, { careStatus: "mat", lostReason: reason, lostNote: note.trim() || undefined, nextTask: undefined }),
      interactions: log(d, messId, "system", `Đánh dấu mất khách. Lý do: ${reason}${note.trim() ? ` – ${note.trim()}` : ""}`, actor.id),
    }));
    return ok(messId);
  },

  reopenLead(actor: Actor, messId: string, note: string): Result {
    if (!can(actor, "lead.write")) return denied();
    if (!note.trim()) return fail("Vui lòng ghi lý do mở lại lead");
    commit((d) => ({
      ...d,
      leads: patchLead(d, messId, { careStatus: "dang-cham", lostReason: undefined, lostNote: undefined }),
      interactions: log(d, messId, "system", `Mở lại lead: ${note.trim()}`, actor.id),
    }));
    return ok(messId);
  },

  setCareStatus(actor: Actor, messId: string, careStatus: CareStatus): Result {
    if (!can(actor, "lead.write")) return denied();
    if (careStatus === "mat") return fail("Dùng thao tác Mất khách để nhập lý do");
    commit((d) => ({ ...d, leads: patchLead(d, messId, { careStatus }) }));
    return ok(messId);
  },

  addInteraction(actor: Actor, messId: string, type: InteractionType, content: string): Result {
    if (!can(actor, "lead.write")) return denied();
    if (!content.trim()) return fail("Nội dung không được để trống");
    commit((d) => ({ ...d, interactions: log(d, messId, type, content.trim(), actor.id) }));
    return ok(messId);
  },

  setNextTask(actor: Actor, messId: string, task: Lead["nextTask"]): Result {
    if (!can(actor, "lead.write")) return denied();
    commit((d) => ({ ...d, leads: patchLead(d, messId, { nextTask: task }) }));
    return ok(messId);
  },

  /** Lưu 6 thông tin. Ô để trống là "thiếu", không tự điền. */
  saveProfile(actor: Actor, messId: string, profile: Lead["profile"]): Result {
    if (!can(actor, "lead.write")) return denied();
    commit((d) => ({
      ...d,
      leads: patchLead(d, messId, { profile }),
      interactions: log(d, messId, "system", "Cập nhật 6 thông tin khách", actor.id),
    }));
    return ok(messId);
  },

  updateCustomer(actor: Actor, customerId: string, patch: Partial<Customer>): Result {
    if (!can(actor, "lead.write")) return denied();
    commit((d) => ({ ...d, customers: d.customers.map((c) => (c.customerId === customerId ? { ...c, ...patch } : c)) }));
    return ok(customerId);
  },

  // ---------- RFQ ----------
  createRfqFromLead(actor: Actor, messId: string, input: NewRfqInput): Result {
    if (!can(actor, "rfq.write")) return denied();
    const lead = state.data.leads.find((l) => l.messId === messId);
    if (!lead) return fail("Không tìm thấy lead");
    if (lead.temperature !== "hot") return fail("Chỉ lead Hot mới tạo RFQ");
    if (lead.careStatus === "mat") return fail("Lead đã mất khách");
    if (lead.goodsOrigin === "unknown") return fail("Cần xác định xuất xứ hàng để phân tuyến trước khi tạo RFQ");
    let id = "";
    commit((d) => {
      id = nextId("RFQ-", d.rfqs.map((r) => r.rfqId), 4);
      const rfq: Rfq = {
        rfqId: id,
        messId,
        customerId: lead.customerId,
        createdAt: CRM_TODAY,
        route: lead.goodsOrigin === "vn" ? "vn" : "global",
        goodsOrigin: lead.goodsOrigin,
        status: "moi",
        ...input,
        priceRequest: { sourcing: "chua-gui", logistics: "chua-gui" },
        ownerId: lead.ownerId,
      };
      return {
        ...d,
        rfqs: [rfq, ...d.rfqs],
        leads: patchLead(d, messId, { careStatus: "da-co-rfq" }),
        interactions: log(d, messId, "system", `Tạo RFQ ${id}`, actor.id),
      };
    });
    return ok(id);
  },

  updateRfq(actor: Actor, rfqId: string, patch: Partial<NewRfqInput>): Result {
    if (!can(actor, "rfq.write")) return denied();
    commit((d) => ({ ...d, rfqs: patchRfq(d, rfqId, patch) }));
    return ok(rfqId);
  },

  /** Bàn giao yêu cầu giá cho Sourcing (giá hàng) và/hoặc Logistics (cước). */
  sendPriceRequest(actor: Actor, rfqId: string, targets: { sourcing: boolean; logistics: boolean }): Result {
    if (!can(actor, "rfq.write")) return denied();
    const rfq = state.data.rfqs.find((r) => r.rfqId === rfqId);
    if (!rfq) return fail("Không tìm thấy RFQ");
    if (!targets.sourcing && !targets.logistics) return fail("Chọn ít nhất một bộ phận nhận yêu cầu giá");
    if (!rfq.goodsName.trim() || rfq.quantity <= 0 || !rfq.originPoint.trim() || !rfq.destination.trim()) {
      return fail("Cần đủ hàng hóa, số lượng, điểm đi và điểm đến trước khi gửi yêu cầu giá");
    }
    commit((d) => ({
      ...d,
      rfqs: patchRfq(d, rfqId, {
        status: "cho-gia",
        priceRequest: {
          sourcing: targets.sourcing ? "cho-gia" : rfq.priceRequest.sourcing,
          logistics: targets.logistics ? "cho-gia" : rfq.priceRequest.logistics,
          sentAt: CRM_TODAY,
        },
      }),
      interactions: log(
        d,
        rfq.messId,
        "system",
        `Bàn giao yêu cầu giá ${rfqId} cho ${[targets.sourcing && "Sourcing", targets.logistics && "Logistics"].filter(Boolean).join(" và ")}`,
        actor.id,
      ),
    }));
    return ok(rfqId);
  },

  /** MÔ PHỎNG: Vận hành trả giá. Module Vận hành chưa có nên demo cho phép giả lập. */
  simulatePriceReturn(actor: Actor, rfqId: string): Result {
    if (!can(actor, "rfq.write")) return denied();
    const rfq = state.data.rfqs.find((r) => r.rfqId === rfqId);
    if (!rfq || rfq.status !== "cho-gia") return fail("RFQ chưa ở trạng thái chờ giá");
    commit((d) => ({
      ...d,
      rfqs: patchRfq(d, rfqId, { status: "da-co-gia", priceRequest: { ...rfq.priceRequest, sourcing: "da-co-gia", logistics: "da-co-gia" } }),
      interactions: log(d, rfq.messId, "system", `Vận hành trả giá cho ${rfqId} (mô phỏng)`, actor.id),
    }));
    return ok(rfqId);
  },

  /** Vận hành trả giá cho Sale khi đã chọn xưởng (gọi từ module Sourcing). */
  returnPrices(actor: Actor, rfqId: string): Result {
    if (!opsPermissions["price.return"].includes(actor.role)) return denied();
    const rfq = state.data.rfqs.find((r) => r.rfqId === rfqId);
    if (!rfq) return fail("Không tìm thấy RFQ");
    if (rfq.status !== "cho-gia") return ok(rfqId); // đã trả giá hoặc đã đi tiếp
    commit((d) => ({
      ...d,
      rfqs: patchRfq(d, rfqId, { status: "da-co-gia", priceRequest: { ...rfq.priceRequest, sourcing: "da-co-gia", logistics: "da-co-gia" } }),
      interactions: log(d, rfq.messId, "system", `Vận hành trả giá hàng/cước cho ${rfqId}`, actor.id),
    }));
    return ok(rfqId);
  },

  cancelRfq(actor: Actor, rfqId: string): Result {
    if (!can(actor, "rfq.write")) return denied();
    commit((d) => ({ ...d, rfqs: patchRfq(d, rfqId, { status: "da-huy" }) }));
    return ok(rfqId);
  },

  // ---------- Báo giá ----------
  createQuotation(actor: Actor, rfqId: string): Result {
    if (!can(actor, "quote.write")) return denied();
    const rfq = state.data.rfqs.find((r) => r.rfqId === rfqId);
    if (!rfq) return fail("Không tìm thấy RFQ");
    if (rfq.status !== "da-co-gia") return fail("Cần có giá hàng/cước từ Vận hành trước khi soạn báo giá");
    let id = "";
    commit((d) => {
      id = nextId("BG-", d.quotations.map((q) => q.quoteId), 4);
      const line = (n: string, label: string, quantity: number): QuoteLine => ({ id: n, label, quantity, unitPrice: 0 });
      const q: Quotation = {
        quoteId: id,
        rfqId,
        messId: rfq.messId,
        customerId: rfq.customerId,
        version: 1,
        status: "nhap",
        currency: "VND",
        createdAt: CRM_TODAY,
        validUntil: CRM_TODAY,
        goods: [line("g1", rfq.goodsName, rfq.quantity)],
        freight: [line("c1", "Cước vận chuyển", 1)],
        surcharges: [],
        discountPercent: 0,
        approval: { state: "khong-can" },
        termsNote: "Báo giá có hiệu lực 15 ngày. Điều khoản thanh toán và cam kết theo hợp đồng.",
        ownerId: rfq.ownerId,
      };
      return { ...d, quotations: [q, ...d.quotations], interactions: log(d, rfq.messId, "system", `Tạo báo giá nháp ${id}`, actor.id) };
    });
    return ok(id);
  },

  /** Lưu nháp. Sửa nội dung sẽ hủy phê duyệt đã có. */
  saveQuotation(actor: Actor, quote: Quotation): Result {
    if (!can(actor, "quote.write")) return denied();
    const cur = state.data.quotations.find((q) => q.quoteId === quote.quoteId);
    if (!cur || cur.status !== "nhap") return fail("Chỉ sửa được báo giá ở trạng thái nháp");
    commit((d) => ({ ...d, quotations: patchQuote(d, quote.quoteId, { ...quote, approval: { state: "khong-can" } }) }));
    return ok(quote.quoteId);
  },

  /** Giảm giá vượt ngưỡng mô phỏng thì phải qua duyệt trước khi gửi. */
  submitQuotation(actor: Actor, quoteId: string): Result {
    if (!can(actor, "quote.write")) return denied();
    const q = state.data.quotations.find((x) => x.quoteId === quoteId);
    if (!q || q.status !== "nhap") return fail("Báo giá không ở trạng thái nháp");
    if (quoteTotals(q).total <= 0) return fail("Báo giá chưa có giá trị, hãy nhập đơn giá");
    if (!quoteNeedsApproval(q) || q.approval.state === "da-duyet") return actions.sendQuotation(actor, quoteId);
    commit((d) => ({
      ...d,
      quotations: patchQuote(d, quoteId, { status: "cho-duyet", approval: { state: "cho-duyet" } }),
      interactions: log(d, q.messId, "system", `Gửi duyệt báo giá ${quoteId} (giảm ${q.discountPercent}%, mô phỏng)`, actor.id),
    }));
    return ok(quoteId);
  },

  /** MÔ PHỎNG phê duyệt: Trưởng phòng Sale / Ban GĐ. Duyệt xong báo giá về nháp, Sale bấm gửi. */
  reviewQuotation(actor: Actor, quoteId: string, approve: boolean, note: string): Result {
    const isLead = actor.role === "sale-vn" || actor.role === "sale-global";
    if (!(crmPermissions["board.approve"].includes(actor.role) || isLead)) return denied();
    const q = state.data.quotations.find((x) => x.quoteId === quoteId);
    if (!q || q.status !== "cho-duyet") return fail("Báo giá không ở trạng thái chờ duyệt");
    if (!approve && !note.trim()) return fail("Từ chối cần ghi lý do");
    commit((d) => ({
      ...d,
      quotations: patchQuote(d, quoteId, { status: "nhap", approval: { state: approve ? "da-duyet" : "bi-tu-choi", note: note.trim() || undefined } }),
      interactions: log(d, q.messId, "system", `${approve ? "Duyệt" : "Từ chối"} báo giá ${quoteId} (mô phỏng)${note.trim() ? `: ${note.trim()}` : ""}`, actor.id),
    }));
    return ok(quoteId);
  },

  sendQuotation(actor: Actor, quoteId: string): Result {
    if (!can(actor, "quote.write")) return denied();
    const q = state.data.quotations.find((x) => x.quoteId === quoteId);
    if (!q || q.status !== "nhap") return fail("Báo giá không ở trạng thái nháp");
    if (quoteNeedsApproval(q) && q.approval.state !== "da-duyet") return fail("Giảm giá vượt ngưỡng mô phỏng, cần được duyệt trước khi gửi");
    commit((d) => ({
      ...d,
      quotations: patchQuote(d, quoteId, { status: "da-gui", sentAt: CRM_TODAY }),
      rfqs: patchRfq(d, q.rfqId, { status: "da-bao-gia" }),
      interactions: log(d, q.messId, "system", `Đã gửi báo giá ${quoteId} cho khách`, actor.id),
    }));
    return ok(quoteId);
  },

  recordQuoteResponse(actor: Actor, quoteId: string, accepted: boolean, note: string): Result {
    if (!can(actor, "quote.write")) return denied();
    const q = state.data.quotations.find((x) => x.quoteId === quoteId);
    if (!q || q.status !== "da-gui") return fail("Báo giá chưa ở trạng thái đã gửi");
    if (!accepted && !note.trim()) return fail("Khách từ chối cần ghi lý do");
    commit((d) => ({
      ...d,
      quotations: patchQuote(d, quoteId, { status: accepted ? "chap-nhan" : "tu-choi", responseNote: note.trim() || undefined }),
      rfqs: accepted ? patchRfq(d, q.rfqId, { status: "da-chot" }) : d.rfqs,
      interactions: log(d, q.messId, "system", `Khách ${accepted ? "chấp nhận" : "từ chối"} báo giá ${quoteId}${note.trim() ? `: ${note.trim()}` : ""}`, actor.id),
    }));
    return ok(quoteId);
  },

  // ---------- Hợp đồng & cọc ----------
  /** 1 đơn = 1 hợp đồng. Demo cấp order_id ngay khi tạo hợp đồng (quy trình thật do Vận hành cấp sau bàn giao). */
  createContractFromQuote(actor: Actor, quoteId: string): Result {
    if (!can(actor, "contract.write")) return denied();
    const q = state.data.quotations.find((x) => x.quoteId === quoteId);
    if (!q || q.status !== "chap-nhan") return fail("Chỉ tạo hợp đồng từ báo giá khách đã chấp nhận");
    if (state.data.contracts.some((c) => c.rfqId === q.rfqId && c.status !== "huy")) return fail("RFQ này đã có hợp đồng");
    const rfq = state.data.rfqs.find((r) => r.rfqId === q.rfqId);
    if (!rfq) return fail("Không tìm thấy RFQ");
    let id = "";
    commit((d) => {
      id = nextId("DH-2026-", d.contracts.map((c) => c.orderId), 4);
      const value = quoteTotals(q).total;
      const contract: Contract = {
        orderId: id,
        contractNo: `HD-2026-${id.slice(-4)}`,
        rfqId: q.rfqId,
        messId: q.messId,
        customerId: q.customerId,
        quoteId,
        route: rfq.route,
        value,
        currency: q.currency,
        status: "soan-thao",
        createdAt: CRM_TODAY,
        boardApproval: contractNeedsBoard(value) ? "cho-duyet" : "khong-can",
        deposit: { status: "chua-yeu-cau", amount: Math.round((value * simulatedApprovals.depositPercent) / 100 / 1000) * 1000 },
        handover: { status: "chua" },
        ownerId: q.ownerId,
      };
      return { ...d, contracts: [contract, ...d.contracts], interactions: log(d, q.messId, "system", `Tạo hợp đồng ${contract.contractNo} / ${id}`, actor.id) };
    });
    return ok(id);
  },

  boardReview(actor: Actor, orderId: string, approve: boolean): Result {
    if (!can(actor, "board.approve")) return denied();
    const c = state.data.contracts.find((x) => x.orderId === orderId);
    if (!c || c.boardApproval !== "cho-duyet") return fail("Hợp đồng không chờ Ban GĐ duyệt");
    commit((d) => ({ ...d, contracts: patchContract(d, orderId, { boardApproval: approve ? "da-duyet" : "bi-tu-choi" }) }));
    return ok(orderId);
  },

  signContract(actor: Actor, orderId: string): Result {
    if (!can(actor, "contract.write")) return denied();
    const c = state.data.contracts.find((x) => x.orderId === orderId);
    if (!c || c.status !== "soan-thao") return fail("Hợp đồng không ở trạng thái soạn thảo");
    if (c.boardApproval === "cho-duyet" || c.boardApproval === "bi-tu-choi") return fail("Hợp đồng vượt ngưỡng mô phỏng, cần Ban GĐ duyệt trước");
    commit((d) => ({
      ...d,
      contracts: patchContract(d, orderId, { status: "da-ky", signedAt: CRM_TODAY }),
      interactions: log(d, c.messId, "system", `Hợp đồng ${c.contractNo} đã ký`, actor.id),
    }));
    return ok(orderId);
  },

  requestDeposit(actor: Actor, orderId: string, input: DepositRequestInput): Result {
    if (!can(actor, "deposit.request")) return denied();
    const c = state.data.contracts.find((x) => x.orderId === orderId);
    if (!c) return fail("Không tìm thấy hợp đồng");
    if (!canRequestDeposit(c)) return fail("Hợp đồng chưa đủ điều kiện yêu cầu xác nhận cọc (cần đã ký và đã được duyệt nếu vượt ngưỡng)");
    if (input.amount <= 0) return fail("Số tiền cọc phải lớn hơn 0");
    if (!input.billRef.trim()) return fail("Vui lòng nhập mã/ghi chú bill chuyển khoản");
    commit((d) => ({
      ...d,
      contracts: patchContract(d, orderId, {
        deposit: { status: "cho-ke-toan", amount: input.amount, requestedAt: CRM_TODAY, requestedBy: actor.id, channel: input.channel, billRef: input.billRef.trim(), note: input.note.trim() || undefined },
      }),
      interactions: log(d, c.messId, "system", `Yêu cầu Kế toán xác nhận cọc cho ${c.orderId}`, actor.id),
    }));
    return ok(orderId);
  },

  /** Chỉ role Kế toán. */
  confirmDeposit(actor: Actor, orderId: string): Result {
    if (!can(actor, "deposit.confirm")) return fail("Chỉ Kế toán được xác nhận Đã cọc");
    const c = state.data.contracts.find((x) => x.orderId === orderId);
    if (!c || c.deposit.status !== "cho-ke-toan") return fail("Hợp đồng không chờ xác nhận cọc");
    commit((d) => ({
      ...d,
      contracts: patchContract(d, orderId, { deposit: { ...c.deposit, status: "da-coc", confirmedAt: CRM_TODAY, confirmedBy: actor.id, mismatchNote: undefined } }),
      interactions: log(d, c.messId, "system", `Kế toán xác nhận Đã cọc cho ${c.orderId}`, actor.id),
    }));
    return ok(orderId);
  },

  markDepositMismatch(actor: Actor, orderId: string, note: string): Result {
    if (!can(actor, "deposit.confirm")) return fail("Chỉ Kế toán được đối soát cọc");
    const c = state.data.contracts.find((x) => x.orderId === orderId);
    if (!c || c.deposit.status !== "cho-ke-toan") return fail("Hợp đồng không chờ xác nhận cọc");
    if (!note.trim()) return fail("Vui lòng ghi rõ điểm không khớp");
    commit((d) => ({
      ...d,
      contracts: patchContract(d, orderId, { deposit: { ...c.deposit, status: "khong-khop", mismatchNote: note.trim() } }),
      interactions: log(d, c.messId, "system", `Kế toán báo cọc ${c.orderId} không khớp: ${note.trim()}`, actor.id),
    }));
    return ok(orderId);
  },

  /** Cổng: chưa "Đã cọc" thì không chuyển sang bước bàn giao / đặt xưởng. */
  handOverToOperations(actor: Actor, orderId: string): Result {
    if (!can(actor, "deposit.request")) return denied();
    const c = state.data.contracts.find((x) => x.orderId === orderId);
    if (!c) return fail("Không tìm thấy hợp đồng");
    if (c.deposit.status !== "da-coc") return fail("Chưa có xác nhận Đã cọc của Kế toán, không được bàn giao đặt xưởng");
    if (!canHandOver(c)) return fail("Hợp đồng không thể bàn giao");
    commit((d) => ({
      ...d,
      contracts: patchContract(d, orderId, { handover: { status: "da-ban-giao", at: CRM_TODAY } }),
      interactions: log(d, c.messId, "system", `Bàn giao ${c.orderId} sang Vận hành`, actor.id),
    }));
    return ok(orderId);
  },
};

export type CrmActions = typeof actions;
export { profileCompleteness };

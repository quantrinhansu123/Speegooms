import { accountingPermissions, paymentApproval, type AccountingAction } from "@/config/accounting";
import { CRM_TODAY } from "@/config/crm";
import { getSnapshot as getCrm, type Actor, type Result } from "@/features/crm/store";
import { getSnapshot as getOps } from "@/features/operations/store";
import { localAccountingRepository } from "@/services/accounting/repository";
import { buildSettlement, canApprove, canCreatePayment, canPay, nextSeq } from "@/services/accounting/rules";
import { createStore } from "@/services/store-factory";
import type { AccountingSnapshot, PaymentKind, PaymentPurpose, PaymentRequest } from "@/types/accounting";

/**
 * Store Kế toán. Cọc khách xác nhận bằng thao tác của CRM store (chỉ Kế toán), sổ thu chi suy ra từ cọc + thu thêm + đề nghị đã chi.
 * Chi trả tách ba bước nhập → duyệt → chi; "đã chi" chỉ là ghi nhận trạng thái, KHÔNG thực hiện thanh toán thật.
 */
const empty: AccountingSnapshot = { statementLines: [], customerReceipts: [], payments: [], settlements: [] };
const store = createStore(localAccountingRepository, empty);
export const { subscribe, getSnapshot, getServerSnapshot } = store;
export const startAccounting = store.start;
export const resetAccounting = store.reset;
const { commit } = store;
const state = () => store.getSnapshot().data;

const fail = (error: string): Result => ({ ok: false, error });
const ok = (id?: string): Result => ({ ok: true, id });
const can = (actor: Actor, a: AccountingAction) => accountingPermissions[a].includes(actor.role);
const denied = () => fail("Vai trò hiện tại không có quyền thực hiện thao tác này");
const contractOf = (orderId: string) => getCrm().data.contracts.find((c) => c.orderId === orderId);
const nowTime = () => new Date().toTimeString().slice(0, 5);
const logOf = (p: PaymentRequest, by: string, text: string) => [...p.log, { at: `${CRM_TODAY}T${nowTime()}`, by, text }];
const patch = (d: AccountingSnapshot, id: string, fn: (p: PaymentRequest) => PaymentRequest) => d.payments.map((p) => (p.paymentId === id ? fn(p) : p));

export interface NewPaymentInput {
  kind: PaymentKind;
  payeeId: string;
  orderId: string;
  refId: string;
  purpose: PaymentPurpose;
  amount: number;
  note?: string;
}

export const actions = {
  // ---------- Thu ----------
  recordReceipt(actor: Actor, orderId: string, amount: number, ref: string): Result {
    if (!can(actor, "ledger.write")) return fail("Chỉ Kế toán được ghi nhận khoản thu");
    const c = contractOf(orderId);
    if (!c) return fail("Không tìm thấy đơn hàng");
    if (c.deposit.status !== "da-coc") return fail("Đơn chưa có xác nhận Đã cọc, xác nhận cọc trước khi ghi nhận thu thêm");
    if (!(amount > 0)) return fail("Số tiền phải lớn hơn 0");
    if (!ref.trim()) return fail("Nhập mã tham chiếu giao dịch / sao kê");
    let id = "";
    commit((d) => {
      id = nextSeq("RCPT-", d.customerReceipts.map((r) => r.receiptId), 4);
      return { ...d, customerReceipts: [...d.customerReceipts, { receiptId: id, orderId, date: CRM_TODAY, amount, ref: ref.trim(), recordedBy: actor.id }] };
    });
    return ok(id);
  },

  // ---------- Chi: nhập → duyệt → chi ----------
  createPayment(actor: Actor, input: NewPaymentInput): Result {
    if (!can(actor, "pay.create")) return fail("Chỉ Vận hành nhập đề nghị thanh toán (nhập, duyệt, chi tách nhau)");
    const gate = canCreatePayment(contractOf(input.orderId));
    if (!gate.ok) return fail(gate.reason);
    if (!(input.amount > 0)) return fail("Số tiền phải lớn hơn 0");
    if (!input.payeeId) return fail("Chọn đối tượng nhận");
    let id = "";
    commit((d) => {
      id = nextSeq("PAY-", d.payments.map((p) => p.paymentId), 4);
      const p: PaymentRequest = { paymentId: id, ...input, note: input.note?.trim() || undefined, status: "nhap", requestedBy: actor.id, requestedAt: CRM_TODAY, log: [{ at: `${CRM_TODAY}T${nowTime()}`, by: actor.id, text: "Nhập đề nghị thanh toán" }] };
      return { ...d, payments: [...d.payments, p] };
    });
    return ok(id);
  },

  submitPayment(actor: Actor, paymentId: string): Result {
    if (!can(actor, "pay.create")) return denied();
    const p = state().payments.find((x) => x.paymentId === paymentId);
    if (!p || p.status !== "nhap") return fail("Chỉ gửi duyệt đề nghị ở trạng thái nháp");
    commit((d) => ({ ...d, payments: patch(d, paymentId, (x) => ({ ...x, status: "cho-duyet", log: logOf(x, actor.id, "Gửi duyệt") })) }));
    return ok(paymentId);
  },

  /** Duyệt theo cấp số tiền. NGƯỠNG CHƯA ĐƯỢC CẤU HÌNH: kết quả chỉ mô phỏng. Người duyệt khác người nhập. */
  reviewPayment(actor: Actor, paymentId: string, approve: boolean, note: string): Result {
    const p = state().payments.find((x) => x.paymentId === paymentId);
    if (!p) return fail("Không tìm thấy đề nghị");
    const gate = canApprove(p, actor);
    if (!gate.ok) return fail(gate.reason ?? "Không được duyệt");
    if (!approve && !note.trim()) return fail("Từ chối cần ghi lý do");
    commit((d) => ({
      ...d,
      payments: patch(d, paymentId, (x) => ({
        ...x,
        status: approve ? "da-duyet" : "tu-choi",
        approvedBy: actor.id,
        approvedAt: CRM_TODAY,
        rejectReason: approve ? undefined : note.trim(),
        log: logOf(x, actor.id, approve ? `Duyệt${paymentApproval.configured ? "" : " (ngưỡng mô phỏng)"}` : `Từ chối: ${note.trim()}`),
      })),
    }));
    return ok(paymentId);
  },

  /** Ghi nhận đã chi. KHÔNG chuyển tiền thật. Chỉ Kế toán; cần đã duyệt, đơn đã cọc, người chi khác người duyệt. */
  markPaid(actor: Actor, paymentId: string, bankRef: string): Result {
    if (!can(actor, "pay.pay")) return fail("Chỉ Kế toán được ghi nhận chi");
    const p = state().payments.find((x) => x.paymentId === paymentId);
    if (!p) return fail("Không tìm thấy đề nghị");
    const gate = canPay(p, contractOf(p.orderId), actor);
    if (!gate.ok) return fail(gate.reason ?? "Không được chi");
    if (!bankRef.trim()) return fail("Nhập mã tham chiếu chứng từ chi (ví dụ số ủy nhiệm chi) để đối soát");
    commit((d) => ({ ...d, payments: patch(d, paymentId, (x) => ({ ...x, status: "da-chi", paidBy: actor.id, paidAt: CRM_TODAY, bankRef: bankRef.trim(), log: logOf(x, actor.id, "Ghi nhận đã chi (không phải chuyển tiền thật)") })) }));
    return ok(paymentId);
  },

  cancelPayment(actor: Actor, paymentId: string): Result {
    if (!can(actor, "pay.create")) return denied();
    const p = state().payments.find((x) => x.paymentId === paymentId);
    if (!p || (p.status !== "nhap" && p.status !== "tu-choi")) return fail("Chỉ hủy đề nghị ở trạng thái nháp hoặc bị từ chối");
    commit((d) => ({ ...d, payments: patch(d, paymentId, (x) => ({ ...x, status: "huy", log: logOf(x, actor.id, "Hủy đề nghị") })) }));
    return ok(paymentId);
  },

  reconcilePayment(actor: Actor, paymentId: string): Result {
    if (!can(actor, "ledger.write")) return fail("Chỉ Kế toán được đối soát");
    const p = state().payments.find((x) => x.paymentId === paymentId);
    if (!p || p.status !== "da-chi") return fail("Chỉ đối soát khoản đã chi");
    commit((d) => ({ ...d, payments: patch(d, paymentId, (x) => ({ ...x, reconciledAt: CRM_TODAY, log: logOf(x, actor.id, "Đối soát với sao kê") })) }));
    return ok(paymentId);
  },

  // ---------- Quyết toán ----------
  /** Chốt quyết toán chỉ khi đã giao, đã thu đủ, đã chi xong và chứng từ đủ. Chủ quyết toán chưa được phân (tài liệu), demo cho Kế toán chốt. */
  closeSettlement(actor: Actor, orderId: string, note: string): Result {
    if (!can(actor, "ledger.write")) return fail("Chỉ Kế toán được chốt quyết toán");
    const view = buildSettlement(orderId, getCrm().data, getOps().data, state());
    if (!view) return fail("Không tìm thấy đơn hàng");
    const unmet = view.conditions.filter((c) => !c.ok);
    if (unmet.length) return fail(`Chưa đủ điều kiện: ${unmet.map((c) => c.label).join("; ")}`);
    commit((d) => ({
      ...d,
      settlements: d.settlements.some((s) => s.orderId === orderId)
        ? d.settlements.map((s) => (s.orderId === orderId ? { ...s, status: "da-quyet-toan", closedAt: CRM_TODAY, closedBy: actor.id, note: note.trim() || undefined } : s))
        : [...d.settlements, { orderId, status: "da-quyet-toan", closedAt: CRM_TODAY, closedBy: actor.id, note: note.trim() || undefined }],
    }));
    return ok(orderId);
  },

  startSettlement(actor: Actor, orderId: string): Result {
    if (!can(actor, "ledger.write")) return fail("Chỉ Kế toán được mở quyết toán");
    if (state().settlements.some((s) => s.orderId === orderId)) return fail("Đơn đã có hồ sơ quyết toán");
    commit((d) => ({ ...d, settlements: [...d.settlements, { orderId, status: "dang-quyet-toan" }] }));
    return ok(orderId);
  },
};

export type AccountingActions = typeof actions;

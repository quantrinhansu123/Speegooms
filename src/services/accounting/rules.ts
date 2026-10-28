import { tierFor } from "../../config/accounting.ts";
import { doneCount } from "../ops/rules.ts";
import type { AccountingSnapshot, PaymentRequest, StatementLine } from "@/types/accounting";
import type { Contract, CrmSnapshot } from "@/types/crm";
import type { OpsSnapshot } from "@/types/ops";
import type { Role } from "@/types/role";

/** Quy tắc nghiệp vụ Kế toán thuần: sổ thu chi, công nợ, quyết toán, cổng duyệt/chi. Kiểm tra bằng pnpm check:accounting. */

const DAY = 864e5;
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
const sum = <T>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + f(r), 0);

// ---- Cọc / sao kê
export const depositConfirmedAmount = (c: Contract) => (c.deposit.status === "da-coc" ? c.deposit.amount : 0);

/** Gợi ý dòng sao kê khớp một yêu cầu cọc: cùng số tiền (khớp hoàn toàn) hoặc gần nhất theo số tiền (lệch). */
export function matchStatement(contract: Contract, lines: StatementLine[]): { line?: StatementLine; diff?: number; exact: boolean } {
  const cands = lines.filter((l) => l.kind === "thu" && (l.matchedOrderId === contract.orderId || !l.matchedOrderId));
  const exact = cands.find((l) => l.amount === contract.deposit.amount);
  if (exact) return { line: exact, diff: 0, exact: true };
  const near = [...cands].sort((a, b) => Math.abs(a.amount - contract.deposit.amount) - Math.abs(b.amount - contract.deposit.amount))[0];
  return near ? { line: near, diff: near.amount - contract.deposit.amount, exact: false } : { exact: false };
}

// ---- Sổ thu chi (suy ra từ cọc đã xác nhận, thu thêm và đề nghị đã chi)
export type LedgerCategory = "coc-khach" | "thu-khach" | "chi-xuong" | "chi-van-chuyen" | "chi-khac";
export interface LedgerEntry {
  id: string;
  date: string;
  type: "thu" | "chi";
  category: LedgerCategory;
  amount: number;
  orderId: string;
  counterparty: string;
  ref: string;
  reconciled: boolean;
  paymentId?: string;
}

export function buildLedger(crm: Pick<CrmSnapshot, "contracts" | "customers">, ops: Pick<OpsSnapshot, "suppliers" | "partners">, acc: AccountingSnapshot): LedgerEntry[] {
  const cust = new Map(crm.customers.map((c) => [c.customerId, c.name]));
  const entries: LedgerEntry[] = [];
  for (const c of crm.contracts) {
    if (c.deposit.status === "da-coc") {
      entries.push({ id: `coc-${c.orderId}`, date: c.deposit.confirmedAt ?? c.createdAt, type: "thu", category: "coc-khach", amount: c.deposit.amount, orderId: c.orderId, counterparty: cust.get(c.customerId) ?? c.customerId, ref: c.deposit.billRef ?? "", reconciled: true });
    }
  }
  const orderCust = new Map(crm.contracts.map((c) => [c.orderId, cust.get(c.customerId) ?? c.customerId]));
  for (const r of acc.customerReceipts) {
    entries.push({ id: r.receiptId, date: r.date, type: "thu", category: "thu-khach", amount: r.amount, orderId: r.orderId, counterparty: orderCust.get(r.orderId) ?? "", ref: r.ref, reconciled: true });
  }
  const payee = new Map([...ops.suppliers.map((s) => [s.supplierId, s.name] as const), ...ops.partners.map((p) => [p.partnerId, p.name] as const)]);
  for (const p of acc.payments) {
    if (p.status !== "da-chi" || !p.paidAt) continue;
    entries.push({
      id: p.paymentId,
      date: p.paidAt,
      type: "chi",
      category: p.kind === "doi-tac-van-chuyen" ? "chi-van-chuyen" : p.purpose === "khac" ? "chi-khac" : "chi-xuong",
      amount: p.amount,
      orderId: p.orderId,
      counterparty: payee.get(p.payeeId) ?? p.payeeId,
      ref: p.bankRef ?? "",
      reconciled: !!p.reconciledAt,
      paymentId: p.paymentId,
    });
  }
  return entries.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

// ---- Công nợ phải thu / phải trả
export interface ReceivableRow {
  contract: Contract;
  customerName: string;
  received: number;
  outstanding: number;
  dueOn?: string;
  overdueDays: number;
}

export function buildReceivables(crm: Pick<CrmSnapshot, "contracts" | "customers">, ops: Pick<OpsSnapshot, "orders">, acc: AccountingSnapshot, today: string): ReceivableRow[] {
  const cust = new Map(crm.customers.map((c) => [c.customerId, c.name]));
  const due = new Map(ops.orders.map((o) => [o.orderId, o.dueOn]));
  return crm.contracts
    .filter((c) => c.status === "da-ky")
    .map((contract) => {
      const received = depositConfirmedAmount(contract) + sum(acc.customerReceipts.filter((r) => r.orderId === contract.orderId), (r) => r.amount);
      const outstanding = Math.max(0, contract.value - received);
      const dueOn = due.get(contract.orderId);
      return { contract, customerName: cust.get(contract.customerId) ?? contract.customerId, received, outstanding, dueOn, overdueDays: outstanding > 0 && dueOn && dueOn < today ? daysBetween(dueOn, today) : 0 };
    });
}

export const receivedOf = (orderId: string, crm: Pick<CrmSnapshot, "contracts">, acc: AccountingSnapshot) => {
  const c = crm.contracts.find((x) => x.orderId === orderId);
  return (c ? depositConfirmedAmount(c) : 0) + sum(acc.customerReceipts.filter((r) => r.orderId === orderId), (r) => r.amount);
};

export interface PayableRow {
  payeeId: string;
  kind: PaymentRequest["kind"];
  name: string;
  committed: number;
  paid: number;
  awaitingApproval: number;
  approvedUnpaid: number;
  outstanding: number;
}

/** Phải trả theo đối tượng: đã cam kết (đề nghị còn hiệu lực) trừ đã chi. */
export function buildPayables(ops: Pick<OpsSnapshot, "suppliers" | "partners">, acc: AccountingSnapshot): PayableRow[] {
  const name = new Map([...ops.suppliers.map((s) => [s.supplierId, s.name] as const), ...ops.partners.map((p) => [p.partnerId, p.name] as const)]);
  const rows = new Map<string, PayableRow>();
  for (const p of acc.payments) {
    if (p.status === "tu-choi" || p.status === "huy") continue;
    const r = rows.get(p.payeeId) ?? { payeeId: p.payeeId, kind: p.kind, name: name.get(p.payeeId) ?? p.payeeId, committed: 0, paid: 0, awaitingApproval: 0, approvedUnpaid: 0, outstanding: 0 };
    r.committed += p.amount;
    if (p.status === "da-chi") r.paid += p.amount;
    if (p.status === "cho-duyet") r.awaitingApproval += p.amount;
    if (p.status === "da-duyet") r.approvedUnpaid += p.amount;
    r.outstanding = r.committed - r.paid;
    rows.set(p.payeeId, r);
  }
  return [...rows.values()].sort((a, b) => b.outstanding - a.outstanding);
}

// ---- Cổng duyệt / chi
export const approverRoles = (amount: number): Role[] => tierFor(amount).roles;

/** Duyệt: đúng cấp theo số tiền và người duyệt khác người nhập (tách nhiệm vụ). */
export function canApprove(p: PaymentRequest, actor: { id: string; role: Role }): { ok: boolean; reason?: string } {
  if (p.status !== "cho-duyet") return { ok: false, reason: "Đề nghị không ở trạng thái chờ duyệt" };
  if (!approverRoles(p.amount).includes(actor.role)) return { ok: false, reason: `Số tiền thuộc ${tierFor(p.amount).label}, vai trò hiện tại không có quyền duyệt (mô phỏng)` };
  if (p.requestedBy === actor.id) return { ok: false, reason: "Người nhập không được tự duyệt đề nghị của mình" };
  return { ok: true };
}

/** Chi: đã duyệt, đã có xác nhận Đã cọc của khách, và người chi khác người duyệt (tách nhiệm vụ). */
export function canPay(p: PaymentRequest, contract: Contract | undefined, actor: { id: string; role: Role }): { ok: boolean; reason?: string } {
  if (p.status !== "da-duyet") return { ok: false, reason: "Đề nghị phải ở trạng thái Đã duyệt mới ghi nhận chi" };
  if (!contract || contract.deposit.status !== "da-coc") return { ok: false, reason: "Chưa có xác nhận Đã cọc của khách, không được chi" };
  if (p.approvedBy === actor.id) return { ok: false, reason: "Người duyệt không được tự ghi nhận chi" };
  return { ok: true };
}

/** Tạo đề nghị chi: đơn phải đã cọc (không chi khi chưa Đã cọc). */
export const canCreatePayment = (contract: Contract | undefined) =>
  contract && contract.deposit.status === "da-coc" ? { ok: true as const } : { ok: false as const, reason: "Đơn chưa có xác nhận Đã cọc của Kế toán, không tạo đề nghị chi" };

// ---- Quyết toán
export interface SettlementView {
  revenue: number;
  received: number;
  receivable: number;
  poAmount: number;
  carrierActual: number;
  carrierEstimated: number;
  cost: number;
  paidOut: number;
  payableOpen: number;
  margin: number;
  conditions: { key: string; label: string; ok: boolean }[];
  canClose: boolean;
}

export function buildSettlement(orderId: string, crm: Pick<CrmSnapshot, "contracts">, ops: OpsSnapshot, acc: AccountingSnapshot): SettlementView | undefined {
  const contract = crm.contracts.find((c) => c.orderId === orderId);
  if (!contract) return undefined;
  const po = ops.pos.find((p) => p.orderId === orderId && p.status !== "huy");
  const ships = ops.shipments.filter((s) => s.orderId === orderId);
  const pays = acc.payments.filter((p) => p.orderId === orderId && p.status !== "tu-choi" && p.status !== "huy");
  const received = receivedOf(orderId, crm, acc);
  const carrierActual = sum(ships, (s) => (s.costs.actual ? s.costs.actual.freight : 0));
  const carrierEstimated = sum(ships, (s) => s.costs.estimated.freight);
  const poAmount = po?.amount ?? 0;
  const cost = poAmount + carrierActual;
  const delivered = ships.length > 0 && ships.every((s) => doneCount(s) === 6);
  const docs = ops.documents.filter((d) => d.orderId === orderId);
  const conditions = [
    { key: "delivered", label: "Đã giao hàng xong (mọi lô hàng hoàn tất mốc giao)", ok: delivered },
    { key: "received", label: "Đã thu đủ giá trị hợp đồng", ok: contract.value - received <= 0 },
    { key: "paid", label: "Mọi đề nghị chi của đơn đã chi xong", ok: pays.length > 0 && pays.every((p) => p.status === "da-chi") },
    { key: "docs", label: "Chứng từ lô hàng đã duyệt đủ", ok: docs.length > 0 && docs.every((d) => d.status === "da-duyet") },
  ];
  return {
    revenue: contract.value,
    received,
    receivable: Math.max(0, contract.value - received),
    poAmount,
    carrierActual,
    carrierEstimated,
    cost,
    paidOut: sum(pays.filter((p) => p.status === "da-chi"), (p) => p.amount),
    payableOpen: sum(pays.filter((p) => p.status !== "da-chi"), (p) => p.amount),
    margin: contract.value - cost,
    conditions,
    canClose: conditions.every((c) => c.ok),
  };
}

export const nextSeq = (prefix: string, ids: string[], width: number) => {
  const max = ids.reduce((m, id) => {
    const n = id.startsWith(prefix) ? Number(id.slice(prefix.length)) : NaN;
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `${prefix}${String(max + 1).padStart(width, "0")}`;
};

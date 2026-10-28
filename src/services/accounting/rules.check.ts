// Chạy: pnpm check:accounting
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { camelizeKeys } from "../crm/adapters.ts";
import { buildLedger, buildPayables, buildReceivables, buildSettlement, canApprove, canCreatePayment, canPay, matchStatement } from "./rules.ts";
import { paymentApproval, tierFor } from "../../config/accounting.ts";
import type { AccountingSnapshot } from "../../types/accounting.ts";
import type { Contract, Customer } from "../../types/crm.ts";
import type { OpsSnapshot } from "../../types/ops.ts";

const read = (p: string) => JSON.parse(readFileSync(new URL(`../../mocks/${p}.json`, import.meta.url), "utf8"));
const crm = { contracts: camelizeKeys<Contract[]>(read("crm/contracts")), customers: camelizeKeys<Customer[]>(read("crm/customers")) };
const ops = camelizeKeys<OpsSnapshot>({
  suppliers: read("ops/suppliers"), partners: read("ops/partners"), requests: read("ops/requests"), supplier_quotes: read("ops/supplier-quotes"), pos: read("ops/pos"),
  orders: read("ops/orders"), shipments: read("ops/shipments"), tracking_events: read("ops/tracking-events"), documents: read("ops/documents"), history: read("ops/history"),
});
const acc = camelizeKeys<AccountingSnapshot>({
  statement_lines: read("accounting/statement-lines"), customer_receipts: read("accounting/customer-receipts"), payments: read("accounting/payments"), settlements: read("accounting/settlements"),
});
const TODAY = "2026-10-28";
const contractOf = new Map(crm.contracts.map((c) => [c.orderId, c]));

// Không chi khi chưa Đã cọc; mọi đề nghị trong seed thuộc đơn đã cọc
for (const p of acc.payments) assert.equal(contractOf.get(p.orderId)!.deposit.status, "da-coc", `${p.paymentId} thuộc đơn chưa cọc`);
const notDeposited = crm.contracts.find((c) => c.deposit.status !== "da-coc")!;
assert.equal(canCreatePayment(notDeposited).ok, false);
const approved = acc.payments.find((p) => p.status === "da-duyet")!;
assert.equal(canPay(approved, notDeposited, { id: "u-kt", role: "ke-toan" }).ok, false);

// Ba bước tách nhau: nhập → duyệt → chi, mỗi bước có người và thời điểm; người làm khác nhau
for (const p of acc.payments) {
  if (["da-duyet", "da-chi"].includes(p.status)) assert.ok(p.approvedBy && p.approvedAt, `${p.paymentId} thiếu người duyệt`);
  if (p.status === "da-chi") assert.ok(p.paidBy && p.paidAt && p.bankRef, `${p.paymentId} thiếu thông tin chi`);
  if (p.approvedBy) assert.notEqual(p.approvedBy, p.requestedBy, `${p.paymentId}: người nhập tự duyệt`);
  if (p.paidBy && p.approvedBy) assert.notEqual(p.paidBy, p.approvedBy, `${p.paymentId}: người duyệt tự chi`);
}
const waiting = acc.payments.find((p) => p.status === "cho-duyet")!;
assert.equal(canApprove(waiting, { id: waiting.requestedBy, role: "van-hanh" }).ok, false); // người nhập không tự duyệt
assert.equal(canApprove(waiting, { id: "u-kt", role: "ke-toan" }).ok, false); // Kế toán không thuộc cấp duyệt
assert.equal(canApprove(waiting, { id: "u-bgd", role: "ban-gd" }).ok, true);
assert.equal(canPay({ ...approved, approvedBy: "u-kt" }, contractOf.get(approved.orderId), { id: "u-kt", role: "ke-toan" }).ok, false); // người duyệt không tự chi

// Ngưỡng duyệt chưa cấu hình phải được đánh dấu
assert.equal(paymentApproval.configured, false);
assert.equal(tierFor(50_000_000).id, "t1");
assert.equal(tierFor(5_000_000_000).id, "t3");

// Công nợ phải thu khớp dashboard (Σ(giá trị - đã thu) của đơn đang thực hiện/hoàn tất); chuỗi cọc → thu
const ar = buildReceivables(crm, ops, acc, TODAY).filter((r) => r.contract.deposit.status === "da-coc").reduce((a, r) => a + r.outstanding, 0);
const dash = read("data/orders") as { status: string; contractValue: number; paidAmount: number }[];
const dashAr = dash.filter((o) => o.status === "dang-thuc-hien" || o.status === "hoan-tat").reduce((a, o) => a + (o.contractValue - o.paidAmount), 0);
assert.ok(Math.abs(ar - dashAr) < 200_000, `AR ${ar} lệch dashboard ${dashAr}`);

// Sổ thu chi: thu có cọc đã xác nhận, chi chỉ gồm đề nghị đã chi
const ledger = buildLedger(crm, ops, acc);
assert.equal(ledger.filter((e) => e.category === "coc-khach").length, crm.contracts.filter((c) => c.deposit.status === "da-coc").length);
assert.equal(ledger.filter((e) => e.type === "chi").length, acc.payments.filter((p) => p.status === "da-chi").length);
assert.ok(buildPayables(ops, acc).every((r) => r.outstanding >= 0));

// Khớp sao kê cọc: dòng cùng số tiền là khớp hoàn toàn; dòng lệch báo chênh lệch
const mismatch = crm.contracts.find((c) => c.deposit.status === "khong-khop")!;
const m = matchStatement(mismatch, acc.statementLines);
if (m.line) assert.ok((m.diff ?? 0) !== 0);

// Quyết toán: đã quyết toán thì đủ điều kiện thu và chi
for (const s of acc.settlements.filter((x) => x.status === "da-quyet-toan")) {
  const v = buildSettlement(s.orderId, crm, ops, acc)!;
  assert.ok(v.conditions[0].ok && v.conditions[1].ok && v.conditions[2].ok, `${s.orderId} quyết toán khi chưa đủ điều kiện`);
}
const undelivered = crm.contracts.find((c) => c.status === "da-ky" && !acc.settlements.some((s) => s.orderId === c.orderId))!;
assert.equal(buildSettlement(undelivered.orderId, crm, ops, acc)!.canClose, false);
console.log("accounting rules ok");

// Chạy: pnpm check:ops
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { camelizeKeys } from "../crm/adapters.ts";
import { canAdvanceToReady, canPlacePo, delayDays, deriveStage, doneCount, nextMilestone, shipmentStatus } from "./rules.ts";
import type { Contract, Customer, Rfq } from "../../types/crm.ts";
import type { OpsSnapshot } from "../../types/ops.ts";

const read = (p: string) => JSON.parse(readFileSync(new URL(`../../mocks/${p}.json`, import.meta.url), "utf8"));
const crm = {
  contracts: camelizeKeys<Contract[]>(read("crm/contracts")),
  rfqs: camelizeKeys<Rfq[]>(read("crm/rfqs")),
  customers: camelizeKeys<Customer[]>(read("crm/customers")),
};
const ops = camelizeKeys<OpsSnapshot>({
  suppliers: read("ops/suppliers"), requests: read("ops/requests"), supplier_quotes: read("ops/supplier-quotes"), pos: read("ops/pos"),
  orders: read("ops/orders"), shipments: read("ops/shipments"), tracking_events: read("ops/tracking-events"), documents: read("ops/documents"), history: read("ops/history"),
});
const TODAY = "2026-10-28";
const contractOf = new Map(crm.contracts.map((c) => [c.orderId, c]));
const orderOf = new Map(ops.orders.map((o) => [o.orderId, o]));
const rfqOf = new Map(crm.rfqs.map((r) => [r.rfqId, r]));
const quoteOf = new Map(ops.supplierQuotes.map((q) => [q.quoteId, q]));
const supplierOf = new Set(ops.suppliers.map((s) => s.supplierId));

// Không có PO nào khi Kế toán chưa xác nhận Đã cọc, và PO phải qua cổng đặt xưởng
for (const po of ops.pos) {
  const c = contractOf.get(po.orderId)!;
  assert.equal(c.deposit.status, "da-coc", `${po.poId} đặt khi chưa cọc`);
  assert.equal(canPlacePo(c, orderOf.get(po.orderId)).ok, true, po.poId);
  assert.ok(quoteOf.has(po.quoteId) && supplierOf.has(po.supplierId), po.poId);
  assert.equal(quoteOf.get(po.quoteId)!.supplierId, po.supplierId);
}
// Cổng đặt xưởng chặn mọi hợp đồng chưa cọc
for (const c of crm.contracts.filter((x) => x.deposit.status !== "da-coc")) {
  const gate = canPlacePo(c, orderOf.get(c.orderId));
  assert.equal(gate.ok, false);
  assert.match(gate.reason ?? "", /Đã cọc/);
}
// Đơn hàng liên kết đúng RFQ và khách hàng
for (const c of crm.contracts.filter((x) => x.status === "da-ky")) {
  const r = rfqOf.get(c.rfqId)!;
  assert.equal(r.customerId, c.customerId);
  assert.equal(r.messId, c.messId);
}
for (const o of ops.orders) assert.ok(contractOf.has(o.orderId), o.orderId);
// Yêu cầu tìm nguồn trỏ đúng RFQ, báo giá chọn thuộc yêu cầu
for (const r of ops.requests) {
  assert.ok(rfqOf.has(r.rfqId), r.requestId);
  if (r.selectedQuoteId) assert.equal(quoteOf.get(r.selectedQuoteId)!.requestId, r.requestId);
}
// Lô hàng chỉ có khi đơn có PO; trạng thái suy ra từ mốc; mốc hoàn thành là tiền tố liên tục
const poOrders = new Set(ops.pos.map((p) => p.orderId));
for (const s of ops.shipments) {
  assert.ok(poOrders.has(s.orderId), s.shipmentId);
  const done = doneCount(s);
  const next = nextMilestone(s);
  assert.equal(done === 6, next === undefined);
  assert.equal(shipmentStatus(s) === "da-giao", done === 6);
}
// Có lô chậm tiến độ trong seed để demo bộ lọc, và lô đã giao không bao giờ chậm
const delayed = ops.shipments.filter((s) => delayDays(s, TODAY) > 0);
assert.ok(delayed.length > 0);
for (const s of ops.shipments.filter((x) => doneCount(x) === 6)) assert.equal(delayDays(s, TODAY), 0, s.shipmentId);
// Giai đoạn đơn: chưa cọc thì luôn "chờ cọc"
for (const c of crm.contracts.filter((x) => x.status === "da-ky" && x.deposit.status !== "da-coc")) {
  const st = orderOf.get(c.orderId) ?? { orderId: c.orderId, assigneeId: "", dueOn: "", handover: { items: {}, status: "cho-xac-nhan" as const } };
  assert.equal(deriveStage(c, st, undefined, []), "cho-coc");
}
// QC: PO chưa kiểm xong thì không báo sẵn sàng
const pending = ops.pos.find((p) => p.status === "qc" && Object.values(p.qc).some((q) => q.result === "cho"));
if (pending) assert.equal(canAdvanceToReady(pending), false);
console.log("ops rules ok");

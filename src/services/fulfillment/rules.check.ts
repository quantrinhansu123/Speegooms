// Chạy: pnpm check:fulfillment
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { camelizeKeys } from "../crm/adapters.ts";
import { canCreateOutbound, isInStock, packBlockReason, podOutcome, receiptOutcome } from "./rules.ts";
import { doneCount } from "../ops/rules.ts";
import type { Contract } from "../../types/crm.ts";
import type { FulfillmentSnapshot } from "../../types/fulfillment.ts";
import type { Shipment } from "../../types/ops.ts";

const read = (p: string) => JSON.parse(readFileSync(new URL(`../../mocks/${p}.json`, import.meta.url), "utf8"));
const f = camelizeKeys<FulfillmentSnapshot>({ warehouses: read("fulfillment/warehouses"), receipts: read("fulfillment/receipts"), packages: read("fulfillment/packages"), outbounds: read("fulfillment/outbounds"), deliveries: read("fulfillment/deliveries"), inquiries: read("fulfillment/inquiries") });
const contracts = camelizeKeys<Contract[]>(read("crm/contracts"));
const shipments = camelizeKeys<Shipment[]>(read("ops/shipments"));
const shipOf = new Map(shipments.map((s) => [s.shipmentId, s]));
const contractOf = new Map(contracts.map((c) => [c.orderId, c]));

// Hàng chỉ nhập kho khi lô đã về kho đích (mốc Đến kho hoàn thành) và đơn đã cọc
for (const r of f.receipts) {
  const s = shipOf.get(r.shipmentId)!;
  assert.ok(s.milestones.arrive.actualOn, `${r.receiptId}: lô chưa về kho`);
  assert.equal(contractOf.get(r.orderId)!.deposit.status, "da-coc");
  assert.equal(r.status === "cho-nhap", r.receivedQty === 0, r.receiptId);
  if (r.status === "lech") assert.ok(r.note, `${r.receiptId}: lệch mà không ghi chú`);
}
// Mỗi kiện thuộc một phiếu đã nhập; tổng số lượng kiện = số nhận
const byReceipt = new Map<string, number>();
for (const p of f.packages) {
  const r = f.receipts.find((x) => x.receiptId === p.receiptId)!;
  assert.ok(r && r.status !== "cho-nhap", p.packageId);
  assert.match(p.location, /^[A-Z]-\d{2}-\d{2}$/);
  byReceipt.set(p.receiptId, (byReceipt.get(p.receiptId) ?? 0) + p.quantity);
}
for (const [id, q] of byReceipt) assert.equal(q, f.receipts.find((r) => r.receiptId === id)!.receivedQty, id);

// Pick/Pack: đã pick đủ mới đóng gói; đã đóng gói mới giao; giao xong có POD
for (const o of f.outbounds) {
  if (["da-pick", "da-dong-goi", "da-xuat"].includes(o.status)) assert.equal(o.pickedIds.length, o.packageIds.length, o.outboundId);
  if (o.status === "da-dong-goi" || o.status === "da-xuat") assert.ok(o.packed, o.outboundId);
  assert.ok(packBlockReason({ ...o, status: "da-pick", pickedIds: o.packageIds.slice(1) }) || o.packageIds.length === 1);
}
for (const d of f.deliveries) {
  assert.ok(f.outbounds.some((o) => o.outboundId === d.outboundId && o.status === "da-xuat"), d.deliveryId);
  if (d.status === "da-giao") assert.ok(d.pod?.receivedBy && d.pod.note && d.deliveredAt, `${d.deliveryId} thiếu POD`);
}
// Lô đã giao (mốc giao hoàn thành) thì mọi kiện đã giao
for (const s of shipments.filter((x) => doneCount(x) === 6)) {
  const pk = f.packages.filter((p) => p.orderId === s.orderId);
  if (pk.length) assert.ok(pk.every((p) => p.status === "da-giao"), s.shipmentId);
}
// Quy tắc nhập kho, lệnh pick, POD
assert.equal(receiptOutcome(100, 100, "").ok, true);
assert.equal(receiptOutcome(100, 98, "").ok, false); // lệch phải ghi chú
assert.equal(receiptOutcome(100, 98, "Thiếu 2").ok, true);
assert.equal(podOutcome("", "ok").ok, false);
assert.equal(podOutcome("Anh A", "").ok, false);
assert.equal(podOutcome("Anh A", "Đủ hàng").ok, true);
const stocked = f.packages.find((p) => isInStock(p) && p.status === "trong-kho");
if (stocked) assert.equal(canCreateOutbound(stocked.orderId, f).ok, true);
const done = f.outbounds[0];
assert.equal(canCreateOutbound(done.orderId, f).ok, false); // đã có lệnh
assert.equal(canCreateOutbound("DH-NONE", f).ok, false);
// Hỏi tình trạng: câu đã trả lời có người và nội dung
for (const q of f.inquiries) if (q.status === "da-tra-loi") assert.ok(q.answer && q.answeredBy, q.inquiryId);
console.log("fulfillment rules ok");

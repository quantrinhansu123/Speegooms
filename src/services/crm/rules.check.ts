// Chạy: pnpm check:crm
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canHandOver, canMoveToHot, canRequestDeposit, findDuplicateGroups, makeMessId, nextId, quoteTotals, routeFromOrigin } from "./rules.ts";
import { ceilHalf, lineAmount, orderPackageMetrics, packageMetrics } from "./quote-lines.ts";
import { snapshotFromDto } from "./adapters.ts";

const read = (f: string) => JSON.parse(readFileSync(new URL(`../../mocks/crm/${f}.json`, import.meta.url), "utf8"));
const snap = snapshotFromDto({
  staff: read("staff"), customers: read("customers"), leads: read("leads"), interactions: read("interactions"),
  rfqs: read("rfqs"), quotations: read("quotations"), contracts: read("contracts"),
});

// Phân tuyến theo xuất xứ hàng
assert.equal(routeFromOrigin("vn"), "vn");
assert.equal(routeFromOrigin("cn"), "global");
assert.equal(routeFromOrigin("unknown"), null);

// mess_id = ngày + tên khách, trùng thì thêm hậu tố
assert.equal(makeMessId("2026-10-28", "Nguyễn Văn An", []), "MS-20261028-NguyenVanAn");
assert.equal(makeMessId("2026-10-28", "Nguyễn Văn An", ["MS-20261028-NguyenVanAn"]), "MS-20261028-NguyenVanAn-2");
assert.equal(nextId("RFQ-", ["RFQ-0009", "RFQ-0010"], 4), "RFQ-0011");

// Chuỗi khóa trong seed: mess_id → rfq_id → order_id, customer_id
const L = new Set(snap.leads.map((l) => l.messId)), R = new Map(snap.rfqs.map((r) => [r.rfqId, r])), C = new Set(snap.customers.map((c) => c.customerId));
const Q = new Map(snap.quotations.map((q) => [q.quoteId, q]));
assert.equal(L.size, snap.leads.length, "mess_id phải duy nhất");
for (const r of snap.rfqs) assert.ok(L.has(r.messId) && C.has(r.customerId), r.rfqId);
for (const c of snap.contracts) {
  const rfq = R.get(c.rfqId)!;
  assert.equal(rfq.messId, c.messId);
  assert.equal(rfq.customerId, c.customerId);
  assert.equal(Q.get(c.quoteId)!.rfqId, c.rfqId);
  // Hợp đồng đã cọc thì mới được bàn giao
  if (c.handover.status === "da-ban-giao") assert.equal(c.deposit.status, "da-coc", c.orderId);
  if (c.status === "da-ky" && c.deposit.status !== "da-coc") assert.equal(canHandOver(c), false);
  // Giá trị hợp đồng khớp báo giá được chấp nhận
  if (c.status !== "huy") assert.equal(quoteTotals(Q.get(c.quoteId)!).total, c.value, c.orderId);
}
// Lead mất khách phải có lý do; Affiliate chưa có dữ liệu
for (const l of snap.leads) {
  if (l.careStatus === "mat") assert.ok(l.lostReason, l.messId);
  assert.notEqual(l.source, "affiliate");
}

// Cổng cọc
const c = snap.contracts.find((x) => x.deposit.status === "cho-ke-toan")!;
assert.equal(canHandOver(c), false);
assert.equal(canRequestDeposit(c), false); // đã yêu cầu rồi
const bad = snap.contracts.find((x) => x.deposit.status === "khong-khop")!;
assert.equal(canRequestDeposit(bad), true); // không khớp thì được gửi lại

// 6 thông tin: chưa đủ thì không sang Hot
const cold = snap.leads.find((l) => l.temperature === "cold" && Object.values(l.profile).some((p) => p.missing))!;
assert.equal(canMoveToHot(cold).ok, false);

// Phát hiện trùng: seed có 2 cặp trùng cố ý
assert.ok(findDuplicateGroups(snap.customers).length >= 2);
// Dòng hàng báo giá: mẫu Hong Nguyen (105*81*141 cm → 200kg), Mỹ Hoa (110*95*100 → 175kg)
const hong = packageMetrics([{ count: 1, lengthCm: 105, widthCm: 81, heightCm: 141, actualKg: 45 }]);
assert.equal(Math.round(hong.chargeableKg), 200);
const my = packageMetrics([{ count: 5, lengthCm: 110, widthCm: 95, heightCm: 100, actualKg: 30 }]);
assert.equal(my.cbm, 5.225);
// Nhiều kiện khác nhau: mỗi kiện lấy max(cân thực, cân thể tích) rồi cộng, không lấy max của hai tổng.
const mixed = packageMetrics([
  { count: 1, lengthCm: 50, widthCm: 40, heightCm: 30, actualKg: 100 },
  { count: 1, lengthCm: 60, widthCm: 80, heightCm: 50, actualKg: 5 },
  { count: 1, lengthCm: 40, widthCm: 40, heightCm: 30, actualKg: 5 },
]);
assert.equal(mixed.chargeableKg, 148);
assert.equal(packageMetrics([{ count: 1, lengthCm: 100, widthCm: 50, heightCm: 50, actualKg: 10 }], "AIR").chargeableKg, 50);
assert.equal(packageMetrics([{ count: 1, lengthCm: 100, widthCm: 50, heightCm: 50, actualKg: 10 }], "SEA").chargeableKg, 42); // 41,67 làm tròn lên bội 0,5 → 42
// Cân tính cước làm tròn lên bội 0,5 kg: 30,4 → 30,5; 30,6 → 31; 30 và 30,5 giữ nguyên.
assert.deepEqual([30.4, 30.6, 30, 30.5, 30.51, 0.1, 148].map(ceilHalf), [30.5, 31, 30, 30.5, 31, 0.5, 148]);
// Tổng cả đơn cộng cân đã làm tròn của từng dòng (10,2 + 10,2 → 10,5 + 10,5 = 21, không phải 20,4 → 20,5).
const perLine = { count: 1, lengthCm: 10, widthCm: 10, heightCm: 10, actualKg: 10.2 };
assert.equal(packageMetrics([perLine]).chargeableKg, 10.5);
assert.equal(orderPackageMetrics([{ packages: [perLine] }, { packages: [perLine] }]).chargeableKg, 21);
assert.equal(orderPackageMetrics([{ packages: [], weightKg: 25, quantity: 2 }]).chargeableKg, 50);
assert.equal(orderPackageMetrics([{ packages: [perLine], weightKg: 999, quantity: 2 }]).chargeableKg, 10.5);
assert.equal(orderPackageMetrics([{ packages: [], weightKg: 25, quantity: 2 }, { packages: [perLine] }]).chargeableKg, 60.5);
assert.equal(orderPackageMetrics([{ packages: [], weightKg: 25, quantity: 0 }]).chargeableKg, 0);
assert.equal(lineAmount({ basis: "kg", quantity: 4, price: 2, weightKg: 1190, cbm: null }), 9520); // Võ Hải Triều
assert.equal(lineAmount({ basis: "unit", quantity: 5, price: 2137, weightKg: null, cbm: null }), 10685);
assert.equal(lineAmount({ basis: "unit", quantity: 3, price: 0.035, weightKg: null, cbm: null }), 0.105);
assert.equal(lineAmount({ basis: "unit", quantity: null, price: 1, weightKg: null, cbm: null }), null);
assert.equal(lineAmount({ basis: "m2", quantity: 3, price: 12.5, weightKg: null, cbm: null, areaM2: 8 }), 300); // m2 mỗi đơn vị × số lượng × đơn giá
assert.equal(lineAmount({ basis: "m2", quantity: 3, price: 12.5, weightKg: null, cbm: null }), null); // thiếu diện tích thì chưa tính
console.log("crm rules ok");

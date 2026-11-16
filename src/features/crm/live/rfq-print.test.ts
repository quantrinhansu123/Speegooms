import assert from "node:assert/strict";
import test from "node:test";
import { defaultQuoteBank, quoteSheetInputOf, updateQuoteSchema } from "@speego/shared";
import { buildQuoteWorkbook } from "./quote-excel";
import { quoteSheetHtml } from "./quote-print";
import { buildQuoteSheet, draftQuoteSheetInput, printableRfqQuote, quoteOutputProblem, quoteWithLogisticsCosts } from "./quote-sheet";
import type { RfqQuoteRecord } from "./types";

function quote(): RfqQuoteRecord {
  const sourcing = updateQuoteSchema.parse({
    templateId: null, opsNote: "", quoteStatus: "DA_CO_BAO_GIA", contractStatus: "CHUA_TAO",
    orders: [{ id: "00000000-0000-0000-0000-000000000001", name: "Hàng mẫu", selected: true, currency: "VND", lines: [
      { stt: "1", image: "", quantity: 1, pricePerSet: 100, lineTotal: 100, weightKg: null, spec: "Hàng mẫu", note: "", packages: [{ count: 1, lengthCm: 10, widthCm: 10, heightCm: 10, actualKg: 10 }] },
    ] }],
    notes: { totalLabel: "", weightNote: "", validityNote: "", deposit: [] }, bank: defaultQuoteBank,
  });
  const logistics = structuredClone(sourcing);
  logistics.orders[0].currency = "USD";
  logistics.orders[0].lines[0].packages = [{ count: 1, lengthCm: 100, widthCm: 100, heightCm: 100, actualKg: 244.9 }];
  sourcing.orders[0].lines[0].packages = structuredClone(logistics.orders[0].lines[0].packages);
  logistics.notes.freight = { ...logistics.notes.freight, rate: 3.5, total: 857.15 };
  logistics.notes.logisticsFees = [{ label: "Phụ phí địa chỉ", labelEn: "Address surcharge", value: "36", currency: "", itemStt: "" }];
  return {
    ...sourcing, code: "TEST-RFQ", desk: "sourcing", customerKind: "SOURCING", quoteWorkflow: "COMBINED", shippingMode: "SEA", logisticsClass: "LCL",
    sentQuote: { sentAt: "2026-11-05", order: sourcing.orders[0], notes: sourcing.notes, bank: sourcing.bank },
    logisticsSheet: { ...logistics, sentQuote: { sentAt: "2026-11-05", order: logistics.orders[0], notes: structuredClone(logistics.notes), bank: logistics.bank } },
  } as RfqQuoteRecord;
}

test("RFQ print includes sent Logistics freight and surcharges in USD beside VND sourcing goods", async () => {
  const row = quote();
  row.logisticsSheet!.notes.freight.total = 9999;
  const before = structuredClone(row);
  const source = printableRfqQuote(row)!;
  const input = quoteSheetInputOf(source, source.orders[0]);
  const html = quoteSheetHtml(input);
  // Cân tính cước 244,9 kg làm tròn lên 245 kg: 3,5 × 245 = 857,5; cộng phụ phí 36 = 893,5.
  assert.ok(/Tổng chi phí logistics \(USD\)[\s\S]*?893,5/.test(html), "Bản in phải có tổng Logistics 893,5 USD");
  assert.ok(!html.includes("Tổng chi phí logistics (VND)"));
  assert.equal(source.orders[0].currency, "VND");
  assert.equal(source.orders[0].lines[0].lineTotal, 100);
  assert.equal(source.notes.freight.total, 857.5);
  assert.deepEqual(row, before);
  const workbook = await buildQuoteWorkbook(input);
  const values = workbook.worksheets[0].getSheetValues();
  assert.ok(values.some((row) => Array.isArray(row) && row.includes("Tổng chi phí logistics (USD)") && row.includes(893.5)));
});

test("RFQ never includes unpublished Logistics costs and preserves pure Logistics snapshots", () => {
  const row = quote();
  row.logisticsSheet!.sentQuote = null;
  assert.equal(printableRfqQuote(row), null);
  row.desk = "logistics";
  row.customerKind = "LOGISTICS";
  row.sentQuote!.notes.freight.total = 55;
  assert.equal(printableRfqQuote(row)?.notes.freight.total, 55);
});

function shipmentQuote(): RfqQuoteRecord {
  const row = quote();
  const order = row.sentQuote!.order;
  const line = order.lines[0];
  order.currency = "USD";
  order.lines = [
    { ...line, stt: "1", productName: "Marble", quantity: 100, pricePerSet: 9.87, lineTotal: 987,
      packages: [{ count: 1, lengthCm: 245, widthCm: 127, heightCm: 50, actualKg: 1850 }] },
    { ...line, stt: "2", productName: "Lam sóng", quantity: 100, pricePerSet: 15.79, lineTotal: 1579,
      packages: [{ count: 10, lengthCm: 242, widthCm: 17, heightCm: 15, actualKg: 30 }] },
  ];
  row.sentQuote!.notes.totalLabel = "2.566";
  const logistics = row.logisticsSheet!;
  logistics.sentQuote!.order = structuredClone(order);
  logistics.sentQuote!.notes.freight = { ...logistics.sentQuote!.notes.freight, rate: 2.1, total: 4515 };
  logistics.sentQuote!.notes.logisticsFees = [{ label: "Phụ phí kiểm tra thương mại", labelEn: "Commercial inspection", value: "100", currency: "USD", itemStt: "" }];
  logistics.sentQuote!.notes.shippingNotes = ["estimate", "prepay"];
  logistics.sentQuote!.notes.shippingNoteOther = "Giao 40–45 ngày. Khách tự thuê và thanh toán xe nâng.";
  logistics.sentQuote!.notes.opsExtra = "INTERNAL-AGENT-COST-3649";
  row.orders = [structuredClone(order)];
  row.orders[0].lines[0].quantity = 120;
  Object.assign(row.orders[0].lines[1], { quantity: 80, packages: [{ count: 30, lengthCm: 245, widthCm: 125, heightCm: 100, actualKg: 0 }] });
  return row;
}

test("saved draft changes never leak into customer print or Excel; sent shipment remains 2150 kg", async () => {
  const row = shipmentQuote();
  const before = structuredClone(row);
  const source = printableRfqQuote(row)!;
  const input = quoteSheetInputOf(source, source.orders[0]);
  const model = buildQuoteSheet(input);
  assert.deepEqual(model.lines.map(line => line.quantity), [100, 100]);
  assert.equal(model.freight.chargeableKg, 2150);
  assert.equal(model.freight.total, 4515);
  assert.deepEqual(model.feeSubtotals, [{ currency: "USD", amount: 4615 }]);
  assert.equal(model.totals.goods, 2566);
  assert.notEqual(model.totalLabel, "2.566");
  const html = quoteSheetHtml(input);
  assert.doesNotMatch(html, /17\.162,5|INTERNAL-AGENT-COST/);
  assert.match(html, /40–45 ngày/);
  assert.match(html, /thuê và thanh toán xe nâng/);
  assert.match(html, /Thanh toán 100%/);
  const workbook = await buildQuoteWorkbook(input);
  const cells = workbook.worksheets.flatMap(sheet => sheet.getSheetValues().flat());
  const text = JSON.stringify(cells);
  assert.match(text, /2150/);
  assert.match(text, /4615/);
  assert.match(text, /40–45 ngày/);
  assert.match(text, /xe nâng/);
  assert.doesNotMatch(text, /17162\.5|INTERNAL-AGENT-COST/);
  assert.deepEqual(row, before);
});

test("customer output blocks incomplete, returned and mismatched sent snapshots", () => {
  for (const change of [
    (row: RfqQuoteRecord) => { row.sentQuote = null; },
    (row: RfqQuoteRecord) => { row.quoteStatus = "CHUA_CO_BAO_GIA_LAI"; },
    (row: RfqQuoteRecord) => { row.logisticsSheet!.quoteStatus = "CHUA_CO_BAO_GIA_LAI"; },
    (row: RfqQuoteRecord) => { row.logisticsSheet!.sentQuote = null; },
    (row: RfqQuoteRecord) => { row.sentQuote!.order.lines[0].quantity = 120; },
    (row: RfqQuoteRecord) => { row.sentQuote!.order.lines[1].packages[0].count = 30; },
    (row: RfqQuoteRecord) => { row.sentQuote!.order.lines[1].packages[0].actualKg = 0; },
  ]) {
    const row = shipmentQuote();
    change(row);
    assert.ok(quoteOutputProblem(row));
    assert.equal(printableRfqQuote(row), null);
  }
  const row = shipmentQuote();
  assert.throws(() => quoteWithLogisticsCosts(row, row.logisticsSheet!.sentQuote, row.orders[0]), /khác phiên bản/);
});

test("shipping match ignores factory prose, product prices and derived weight rounding", () => {
  const row = shipmentQuote();
  const line = row.logisticsSheet!.sentQuote!.order.lines[0];
  line.spec = "Logistics đã xác nhận cân thực tế";
  line.pricePerSet = null;
  line.lineTotal = null;
  line.weightKg = 18.5;
  line.cbm = 0.01556;
  assert.equal(quoteOutputProblem(row), null);
});

test("draft preview combines current goods and current freight without freezing the sent total", () => {
  const row = shipmentQuote();
  row.logisticsSheet!.notes = structuredClone(row.logisticsSheet!.sentQuote!.notes);
  row.logisticsSheet!.notes.freight.rate = 3;
  row.logisticsSheet!.notes.logisticsFees[0].value = "200";
  const before = structuredClone(row);
  const input = draftQuoteSheetInput(row, row.orders[0], row.logisticsSheet, "vi");
  const model = buildQuoteSheet(input);
  assert.deepEqual(model.lines.map(line => line.quantity), [120, 80]);
  assert.equal(model.freight.chargeableKg, 17162.5);
  assert.equal(model.freight.total, 51487.5);
  assert.deepEqual(model.feeSubtotals, [{ currency: "USD", amount: 51687.5 }]);
  const sent = printableRfqQuote(row)!;
  assert.equal(buildQuoteSheet(quoteSheetInputOf(sent, sent.orders[0])).freight.total, 4515);
  assert.deepEqual(row, before);
  row.sentQuote = null;
  assert.equal(buildQuoteSheet(draftQuoteSheetInput(row, row.orders[0], row.logisticsSheet, "vi")).freight.total, 51487.5);
});

test("draft preview keeps the Logistics currency and intentional manual freight", () => {
  const row = shipmentQuote();
  row.orders[0].currency = "VND";
  row.logisticsSheet!.notes = structuredClone(row.logisticsSheet!.sentQuote!.notes);
  Object.assign(row.logisticsSheet!.notes.freight, { total: 5000, totalManual: true });
  const model = buildQuoteSheet(draftQuoteSheetInput(row, row.orders[0], row.logisticsSheet, "vi"));
  assert.equal(model.currency, "VND");
  assert.equal(model.freight.currency, "USD");
  assert.equal(model.freight.total, 5000);
  assert.deepEqual(model.feeSubtotals, [{ currency: "USD", amount: 5100 }]);
});

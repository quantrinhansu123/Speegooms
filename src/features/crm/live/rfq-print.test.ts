import assert from "node:assert/strict";
import test from "node:test";
import { defaultQuoteBank, quoteSheetInputOf, updateQuoteSchema } from "@speego/shared";
import { buildQuoteWorkbook } from "./quote-excel";
import { quoteSheetHtml } from "./quote-print";
import { printableRfqQuote } from "./quote-sheet";
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
  assert.ok(/Tổng chi phí logistics \(USD\)[\s\S]*?893,15/.test(html), "Bản in phải có tổng Logistics 893,15 USD");
  assert.ok(!html.includes("Tổng chi phí logistics (VND)"));
  assert.equal(source.orders[0].currency, "VND");
  assert.equal(source.orders[0].lines[0].lineTotal, 100);
  assert.equal(source.notes.freight.total, 857.15);
  assert.deepEqual(row, before);
  const workbook = await buildQuoteWorkbook(input);
  const values = workbook.worksheets[0].getSheetValues();
  assert.ok(values.some((row) => Array.isArray(row) && row.includes("Tổng chi phí logistics (USD)") && row.includes(893.15)));
});

test("RFQ never includes unpublished Logistics costs and preserves pure Logistics snapshots", () => {
  const row = quote();
  row.logisticsSheet!.sentQuote = null;
  assert.equal(printableRfqQuote(row)?.notes.freight.total, null);
  row.desk = "logistics";
  row.customerKind = "LOGISTICS";
  row.sentQuote!.notes.freight.total = 55;
  assert.equal(printableRfqQuote(row)?.notes.freight.total, 55);
});

import assert from "node:assert/strict";
import test from "node:test";
import { quoteAmount, updateQuoteSchema, quoteSheetInputOf } from "@speego/shared";
import { quoteSheetHtml } from "./quote-print";
import { buildQuoteWorkbook } from "./quote-excel";

test("HTML/PDF source and Excel show AUD quote, converted VND payment and chosen bank for LCL and FCL", async () => {
  const draft = updateQuoteSchema.parse({
    templateId: null, opsNote: "", quoteStatus: "CHUA_CO_BAO_GIA", contractStatus: "CHUA_TAO",
    orders: [{ id: "00000000-0000-0000-0000-000000000001", name: "AUD quote", selected: true, currency: "AUD", lines: [] }],
    notes: { totalLabel: "", weightNote: "", validityNote: "", deposit: [], freight: { total: 120, totalManual: true, rate: null, currency: "AUD" }, payment: { quoteCurrency: "AUD", currency: "VND", exchangeRate: 16000 } },
    bank: { custom: true, title: "", bankName: "Test Bank", accountName: "<script>test</script>", accountNumber: "0123456789", routingNumber: "" },
  });
  for (const logisticsClass of ["LCL", "FCL"]) {
    if (logisticsClass === "FCL") draft.notes.fcl = { to: "Customer", pol: "", pod: "", etd: "", weight: "", volume: "", commodity: "", stuffingDate: "", notes: "", charges: [{ name: "Freight", rate: 120, quantity: 1, unit: "cont", vatAmount: 0, note: "", optional: false }] };
    const input = quoteSheetInputOf({ ...draft, code: "TEST", customerName: "Test", companyName: null, address: null, phone: null, email: null, shippingMode: "SEA", logisticsClass }, draft.orders[0], "en");
    const html = quoteSheetHtml(input);
    assert.ok(html.includes("1 AUD = 16,000 VND"));
    assert.ok(html.includes("1,920,000 VND"));
    assert.ok(html.includes("0123456789"));
    assert.ok(html.includes("&lt;script&gt;test&lt;/script&gt;"));
    assert.ok(!html.includes("REGIONS BANK"));
    assert.ok(!html.includes("<script>test</script>"));
    const workbook = await buildQuoteWorkbook(input);
    const text = JSON.stringify(workbook.worksheets[0].getSheetValues());
    assert.ok(text.includes("1 AUD = 16,000 VND"));
    assert.ok(text.includes("1,920,000 VND"));
    assert.ok(text.includes("0123456789"));
    assert.ok(!text.includes("0370750653"));
    if (logisticsClass === "FCL") assert.ok(text.includes("QUOTATION · AUD"));
  }
});

test("Logistics insurance fee is billed separately from Sale declared goods in LCL and FCL", async () => {
  for (const logisticsClass of ["LCL", "FCL"]) {
    const draft = updateQuoteSchema.parse({
      templateId: null, opsNote: "", quoteStatus: "CHUA_CO_BAO_GIA", contractStatus: "CHUA_TAO",
      orders: [{ id: "00000000-0000-0000-0000-000000000001", name: "Insured goods", selected: true, insurance: true, currency: "USD",
        lines: [{ stt: "1", quantity: 2, pricePerSet: 1000, lineTotal: 2000, weightKg: 1, spec: "", note: "" }] }],
      notes: { totalLabel: "", weightNote: "", validityNote: "", deposit: [],
        freight: { rate: null, total: 120, totalManual: true, currency: "USD" },
        logisticsFees: logisticsClass === "FCL" ? [] : [{ label: "Phí bảo hiểm", labelEn: "Insurance", value: "25,5", currency: "", itemStt: "" }],
        ...(logisticsClass === "FCL" ? { fcl: { charges: [
          { name: "Freight", rate: 120, quantity: 1, unit: "shipment", vatAmount: 0, note: "" },
          { name: "Insurance", rate: 25.5, quantity: 1, unit: "shipment", vatAmount: 0, note: "" },
        ] } } : {}),
      }, bank: { title: "", accountName: "", accountNumber: "", routingNumber: "" },
    });
    const source = { ...draft, code: "INSURANCE", customerKind: "LOGISTICS", customerName: "Test", companyName: null, address: null, phone: null, email: null, shippingMode: "SEA" as const, logisticsClass };
    assert.equal(quoteAmount(source, "logistics").amount, 145.5);
    assert.equal(draft.orders[0].lines[0].lineTotal, 2000);
    const sheet = quoteSheetInputOf(source, draft.orders[0], "en");
    assert.match(quoteSheetHtml(sheet), /Insurance/);
    const workbook = await buildQuoteWorkbook(sheet);
    assert.match(JSON.stringify(workbook.worksheets[0].getSheetValues()), /Insurance/);
  }
});

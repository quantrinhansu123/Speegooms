import assert from "node:assert/strict";
import test from "node:test";
import { defaultQuoteBank, emptyQuoteFreight, fclQuoteSchema, quoteOrderSchema, resolvedFreightCurrency, withFreightCurrency, type QuoteSheetInput } from "@speego/shared";
import { quoteSheetHtml } from "./quote-print";
import { buildQuoteWorkbook } from "./quote-excel";

test("original costs follow freight currency without changing amounts, including FCL", () => {
  const order = quoteOrderSchema.parse({ id: "00000000-0000-4000-8000-000000000001", name: "Goods", selected: true, currency: "USD", rate: 25000, lines: [] });
  const notes: QuoteSheetInput["notes"] = { totalLabel: "", shippingLabel: "", weightNote: "", validityNote: "", weightNoteEn: "", validityNoteEn: "", deposit: [], depositEn: [], opsExtra: "",
    freight: { ...emptyQuoteFreight, currency: "USD", originalPrice: 450, total: 600, vndRate: 25000 },
    logisticsFees: [{ label: "Fee", labelEn: "", value: "10", currency: "CNY", itemStt: "", originalPrice: 7 }] };
  const cny = withFreightCurrency(notes, order, "CNY");
  assert.equal(resolvedFreightCurrency(cny, "USD"), "CNY");
  assert.equal(cny.freight.originalPrice, 450);
  assert.equal(cny.freight.total, 600);
  assert.equal(cny.freight.vndRate, null);
  assert.equal(cny.logisticsFees[0].originalPrice, 7);
  assert.equal(cny.logisticsFees[0].currency, "");
  assert.equal(withFreightCurrency(cny, order, "USD").freight.vndRate, 25000);
  const fcl = withFreightCurrency({ ...notes, fcl: fclQuoteSchema.parse({ charges: [] }) }, order, "AUD");
  assert.equal(fcl.payment?.quoteCurrency, "AUD");
  assert.equal(fcl.payment?.currency, "AUD");
  assert.equal(withFreightCurrency(fcl, order, "USD").payment?.currency, "USD");
});

test("Sourcing, Logistics and FCL original prices stay out of HTML/PDF source and Excel in both languages", async () => {
  const order = quoteOrderSchema.parse({ id: "00000000-0000-4000-8000-000000000001", name: "Goods", selected: true, currency: "USD",
    lines: [{ stt: "1", productName: "Goods", quantity: 2, pricePerSet: 100, originalPrice: 876543, lineTotal: 200, weightKg: 5, spec: "Spec", note: "Note" }] });
  for (const lang of ["vi", "en"] as const) {
    for (const fcl of [false, true]) {
      const input: QuoteSheetInput = { lang, customer: { customerName: "Customer", companyName: null, address: null, phone: null, email: null },
        lines: order.lines, currency: "USD", bank: defaultQuoteBank, shippingMode: "SEA", logisticsClass: fcl ? "FCL" : "LCL",
        notes: { totalLabel: "", shippingLabel: "", weightNote: "", validityNote: "", weightNoteEn: "", validityNoteEn: "", deposit: [], depositEn: [], opsExtra: "",
          freight: { ...emptyQuoteFreight, originalPrice: 876544, total: 120, totalManual: true },
          logisticsFees: [{ label: "Fee", labelEn: "Fee", value: "10", currency: "USD", itemStt: "", originalPrice: 876545 }],
          ...(fcl ? { fcl: fclQuoteSchema.parse({ charges: [{ name: "Ocean freight", rate: 100, originalPrice: 876546, quantity: 1, unit: "cont", vatAmount: 0, note: "" }] }) } : {}),
        } };
      const html = quoteSheetHtml(input);
      const workbook = await buildQuoteWorkbook(input);
      const excelText = JSON.stringify(workbook.worksheets.map(sheet => sheet.getSheetValues()));
      for (const text of [html, excelText]) {
        assert.doesNotMatch(text, /originalPrice|Giá gốc|Original price|876[.,]?54[3-6]/i);
      }
      assert.ok(html.includes("100") || html.includes("120"));
    }
  }
});

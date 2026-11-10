import assert from "node:assert/strict";
import test from "node:test";
import { defaultQuoteBank, emptyQuoteFreight, type QuoteSheetInput } from "@speego/shared";
import { quoteSheetHtml } from "./quote-print";
import { buildQuoteSheet } from "./quote-sheet";

const input = (notes: Partial<QuoteSheetInput["notes"]>): QuoteSheetInput => ({
  customer: { customerName: null, companyName: null, address: null, phone: null, email: null },
  lines: [],
  currency: "USD",
  bank: defaultQuoteBank,
  notes: {
    totalLabel: "", shippingLabel: "", weightNote: "", validityNote: "", weightNoteEn: "", validityNoteEn: "",
    deposit: [], depositEn: [], logisticsFees: [], opsExtra: "",
    freight: emptyQuoteFreight,
    ...notes,
  },
});

test("manual Sale kg reaches printed freight and packaged lines take priority", () => {
  const source = input({ freight: { ...emptyQuoteFreight, basis: "kg", rate: 12 } });
  source.lines = [{ stt: "1", productName: "Goods", quantity: 2, weightKg: 25, packages: [], spec: "", note: "", image: "", images: [],
    pricePerSet: null, lineTotal: null, lineTotalManual: false, unit: "set", basis: "unit", cbm: null, areaM2: null, specEn: "", noteEn: "", attrs: [], prices: [] }];
  let model = buildQuoteSheet(source);
  assert.equal(model.freight.chargeableKg, 50);
  assert.equal(model.freight.total, 600);
  source.lines[0].packages = [{ count: 1, lengthCm: 10, widthCm: 10, heightCm: 10, actualKg: 20 }];
  model = buildQuoteSheet(source);
  assert.equal(model.freight.chargeableKg, 20);
  assert.equal(model.freight.total, 240);
});

test("print shows freight in the final logistics total with its currency", () => {
  const html = quoteSheetHtml(input({
    shippingLabel: "120",
    freight: { ...emptyQuoteFreight, total: 120, totalManual: true },
  }));
  assert.match(html, /Tổng chi phí logistics \(USD\)[\s\S]*?120/);
});

test("print shows a single logistics fee subtotal in its own currency", () => {
  const html = quoteSheetHtml(input({
    logisticsFees: [{ label: "Phí cảng", labelEn: "", value: "500", currency: "CNY", itemStt: "" }],
  }));
  assert.match(html, /Tổng chi phí logistics \(CNY\)[\s\S]*?500/);
});

test("blank freight currency follows the common fee instead of the order currency", () => {
  const html = quoteSheetHtml({
    ...input({
      freight: { ...emptyQuoteFreight, rate: 3.5, total: 857.15, totalManual: true },
      logisticsFees: [{ label: "Phụ phí địa chỉ", labelEn: "", value: "36", currency: "USD", itemStt: "" }],
    }),
    currency: "VND",
  });
  assert.match(html, /Tổng chi phí logistics \(USD\)[\s\S]*?893,15/);
  assert.doesNotMatch(html, /Tổng chi phí logistics \(VND\)/);
});

test("shipping surcharges print inside the shipping cost section, not under the product table", () => {
  const html = quoteSheetHtml(input({
    freight: { ...emptyQuoteFreight, rate: 3.5, total: 100, totalManual: true },
    logisticsFees: [
      { label: "Phụ phí địa chỉ", labelEn: "", value: "36", currency: "USD", itemStt: "" },
      { label: "Mặt hàng 1 - Ghế", labelEn: "", value: "12", currency: "USD", itemStt: "1" },
    ],
  }));
  const freightAt = html.indexOf("<section class=\"freight\">");
  assert.ok(freightAt > 0);
  const before = html.slice(0, freightAt);
  const freightSection = html.slice(freightAt, html.indexOf("</section>", freightAt));
  for (const label of ["Phụ phí địa chỉ", "Mặt hàng 1 - Ghế"]) {
    assert.doesNotMatch(before, new RegExp(label));
    assert.match(freightSection, new RegExp(label));
  }
});

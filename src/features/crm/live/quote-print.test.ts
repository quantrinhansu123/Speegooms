import assert from "node:assert/strict";
import test from "node:test";
import { defaultQuoteBank, emptyQuoteFreight, fclQuoteSchema, quoteOrderSchema, quoteSheetInputOf, type QuoteSheetInput } from "@speego/shared";
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

test("only uninsured pure Logistics hides the entire product table in print without changing freight", () => {
  const source = { ...input({ freight: { ...emptyQuoteFreight, total: 120, totalManual: true } }), code: "BGL", customerKind: "LOGISTICS" };
  const order = quoteOrderSchema.parse({ id: "00000000-0000-4000-8000-000000000001", name: "Goods", selected: true,
    currency: "USD", priceColumns: [{ currency: "EUR" }],
    lines: [{ stt: "1", productName: "Goods", quantity: 2, pricePerSet: 12345, lineTotal: 24690, weightKg: 5, spec: "", note: "",
      prices: [{ currency: "EUR", pricePerSet: 11111, lineTotal: 22222 }] }] });
  for (const lang of ["vi", "en"] as const) {
    for (const insurance of [undefined, false, true]) {
      const sheet = quoteSheetInputOf({ ...source, ...source.customer }, { ...order, insurance }, lang);
      const model = buildQuoteSheet(sheet);
      const html = quoteSheetHtml(sheet);
      assert.equal(model.showPricing, insurance === true);
      assert.equal(html.includes(model.t.unitPrice), insurance === true);
      assert.equal(html.includes(model.t.lineTotal), insurance === true);
      assert.equal(html.includes(model.t.orderDetails), insurance === true);
      assert.equal(html.includes('<td class="wrap info">Goods</td>'), insurance === true);
      assert.equal(html.includes(`<th>${model.t.stt}</th>`), insurance === true);
      assert.equal(html.includes(`<th>${model.t.metric}</th>`), false);
      assert.equal(model.lines[0].price, insurance ? 12345 : null);
      assert.equal(model.totals.goods, insurance ? 24690 : null);
      assert.equal(model.extraCurrencies.length, insurance ? 1 : 0);
      assert.equal(model.freight.total, 120);
      if (!insurance) assert.doesNotMatch(html, /24[.,]690|22[.,]222/);
      const fclHtml = quoteSheetHtml({ ...sheet, shippingMode: "SEA", logisticsClass: "FCL", notes: { ...sheet.notes, fcl: fclQuoteSchema.parse({ charges: [] }) } });
      assert.equal(fclHtml.includes(model.t.unitPrice), insurance === true);
      assert.equal(fclHtml.includes(model.t.lineTotal), insurance === true);
      assert.equal(fclHtml.includes(model.t.orderDetails), insurance === true);
      assert.equal(fclHtml.includes('<td class="wrap info">Goods</td>'), insurance === true);
      const sourcingSheet = quoteSheetInputOf({ ...source, ...source.customer, customerKind: "SOURCING" }, { ...order, insurance }, lang);
      const sourcingHtml = quoteSheetHtml(sourcingSheet);
      assert.ok(sourcingHtml.includes(model.t.orderDetails));
      assert.ok(sourcingHtml.includes('<td class="wrap info">Goods</td>'));
    }
  }
  assert.equal(buildQuoteSheet(quoteSheetInputOf({ ...source, ...source.customer, customerKind: "SOURCING" }, order)).showPricing, true);
});

test("removing the metric column keeps product, total and deposit cells aligned with extra currencies", () => {
  const order = quoteOrderSchema.parse({ id: "00000000-0000-4000-8000-000000000001", name: "Goods", selected: true,
    currency: "USD", priceColumns: [{ currency: "EUR" }],
    lines: [{ stt: "1", productName: "Goods", quantity: 2, cbm: 3, weightKg: 5, spec: "", note: "", pricePerSet: 10, lineTotal: 20,
      prices: [{ currency: "EUR", pricePerSet: 9, lineTotal: 18 }] }] });
  const source = { ...input({ deposit: ["Deposit"] }), lines: order.lines, priceColumns: order.priceColumns };
  const html = quoteSheetHtml(source);
  for (const table of html.matchAll(/<table class="(?:items|summary(?: deposit)?)">([\s\S]*?)<\/table>/g)) {
    const columns = [...table[1].matchAll(/<col style=/g)].length;
    assert.equal(columns, 10);
    for (const row of table[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
      const cells = [...row[1].matchAll(/<(?:td|th)\b([^>]*)>/g)];
      assert.equal(cells.reduce((count, cell) => count + Number(/colspan="(\d+)"/.exec(cell[1])?.[1] ?? 1), 0), columns);
    }
  }
});

test("shipping notes render once after the logistics total", () => {
  const html = quoteSheetHtml(input({ shippingNotes: ["measure", "estimate"], shippingNoteOther: "Unique freight note" }));
  assert.equal(html.split('class="freight-note"').length - 1, 1);
  assert.equal(html.split("Unique freight note").length - 1, 1);
  assert.ok(html.indexOf('class="freight-note"') > html.indexOf('class="freight-table"'));
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

test("uninsured goods hide prices in Excel and keep a legacy shipping total in print", async () => {
  const { buildQuoteWorkbook } = await import("./quote-excel");
  for (const showPricing of [false, true]) {
    const sheet = { ...input({ shippingLabel: "987" }), showPricing };
    const workbook = await buildQuoteWorkbook(sheet);
    const ws = workbook.worksheets[0];
    assert.equal(Boolean(ws.getColumn(7).hidden), !showPricing);
    assert.equal(Boolean(ws.getColumn(8).hidden), !showPricing);
    assert.match(quoteSheetHtml(sheet), /987/);
  }
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

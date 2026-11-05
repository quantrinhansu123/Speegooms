import assert from "node:assert/strict";
import test from "node:test";
import { defaultQuoteBank, emptyQuoteFreight, type QuoteSheetInput } from "@speego/shared";
import { quoteSheetHtml } from "./quote-print";

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

import assert from "node:assert/strict";
import test from "node:test";
import { defaultQuoteBank, type QuoteSheetInput } from "@speego/shared";
import { quoteSheetHtml } from "./quote-print";

const input = (notes: Partial<QuoteSheetInput["notes"]>): QuoteSheetInput => ({
  customer: { customerName: null, companyName: null, address: null, phone: null, email: null },
  lines: [],
  currency: "USD",
  bank: defaultQuoteBank,
  notes: {
    totalLabel: "", shippingLabel: "", weightNote: "", validityNote: "", weightNoteEn: "", validityNoteEn: "",
    deposit: [], depositEn: [], logisticsFees: [], opsExtra: "",
    freight: { rate: null, total: null, totalManual: false },
    ...notes,
  },
});

test("print shows entered shipping total with currency even when freight matches", () => {
  const html = quoteSheetHtml(input({
    shippingLabel: "120",
    freight: { rate: null, total: 120, totalManual: true },
  }));
  assert.match(html, /Tổng chi phí vận chuyển[\s\S]*?120[\s\S]*?USD/);
});

test("print shows a single logistics fee subtotal in its own currency", () => {
  const html = quoteSheetHtml(input({
    logisticsFees: [{ label: "Phí cảng", labelEn: "", value: "500", currency: "CNY", itemStt: "" }],
  }));
  assert.match(html, /Tổng chi phí logistics \(CNY\)[\s\S]*?500/);
});

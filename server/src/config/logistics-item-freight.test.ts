import assert from "node:assert/strict";
import test from "node:test";
import type pg from "pg";
import { defaultQuoteBank, logisticsQuoteFinancials, quoteFreightTotal, quoteVndAmount, quoteVndRateError, updateQuoteSchema } from "@speego/shared";
import { PostgresCrmRepository } from "../adapters/postgres/crm.repository";

const draft = () => updateQuoteSchema.parse({ templateId: null, opsNote: "", quoteStatus: "CHUA_CO_BAO_GIA", contractStatus: "CHUA_TAO", bank: defaultQuoteBank,
  orders: [{ id: "00000000-0000-4000-8000-000000000001", name: "Items", selected: true, currency: "VND", lines: [
    { stt: "1", productName: "Goods 1", quantity: 1, pricePerSet: null, lineTotal: null, weightKg: 2, spec: "Spec", note: "" }, { stt: "2", productName: "Goods 2", quantity: 1, pricePerSet: null, lineTotal: null, weightKg: 2, spec: "Spec", note: "" } ] }],
  notes: { totalLabel: "", weightNote: "", validityNote: "", deposit: [],
    freight: { basis: "item", currency: "USD", vndRate: 25000, rate: 999, total: 99999, totalManual: true },
    logisticsFees: [
      { label: "Item 1", itemStt: "1", currency: "USD", vndRate: 25000, rate: 10, weightKg: 2, value: "20", originalPrice: 12, originalDetails: { currency: "USD", vndRate: 25000, rate: 6, quantity: 2 } },
      { label: "Item 2", itemStt: "2", currency: "CNY", vndRate: 3500, rate: 20, weightKg: 3, value: "60", originalPrice: 40, originalDetails: { currency: "CNY", vndRate: 3500, rate: 10, quantity: 4 } },
    ] } });

test("per-item freight converts each currency and ignores the previous aggregate freight", () => {
  const sheet = draft();
  assert.equal(quoteFreightTotal(sheet.notes.freight, 100, 10), 0);
  assert.equal(quoteVndRateError(sheet, "logistics"), null);
  assert.equal(quoteVndAmount(sheet, "logistics").vnd, 710000);
  assert.deepEqual(logisticsQuoteFinancials(sheet), { cost: 440000, revenue: 710000, profit: 270000 });
  const sent = structuredClone(sheet);
  sent.notes.freight.basis = "lump";
  sent.notes.freight.total = 100;
  assert.equal(logisticsQuoteFinancials({ ...sheet, sentQuote: { order: sheet.orders[0], notes: sent.notes } } as typeof sheet).revenue, 710000);
});

test("missing rates, costs, or item rows cannot produce misleading financials", () => {
  const sheet = draft();
  sheet.notes.logisticsFees[1].vndRate = null;
  assert.match(quoteVndRateError(sheet, "logistics")!, /CNY/);
  assert.equal(quoteVndAmount(sheet, "logistics").vnd, null);
  sheet.notes.logisticsFees[1].vndRate = 3500;
  sheet.notes.logisticsFees[1].originalPrice = null;
  assert.equal(logisticsQuoteFinancials(sheet).cost, null);
  assert.equal(logisticsQuoteFinancials(sheet).profit, null);
  sheet.notes.logisticsFees.pop();
  assert.match(quoteVndRateError(sheet, "logistics")!, /2/);
  assert.deepEqual(logisticsQuoteFinancials(sheet), { cost: null, revenue: null, profit: null });
});

test("new freight details survive repository reads in draft and sent snapshots on both lanes", async () => {
  const input = draft();
  input.notes.freight.originalDetails = { currency: "USD", vndRate: 25000, rate: 5, quantity: 2 };
  for (const lane of ["vn", "global"] as const) {
    const repo = new PostgresCrmRepository({ query: async () => ({ rowCount: 1, rows: [{ customer_kind: "LOGISTICS", created_at: new Date(), order_lines: input.orders, common_notes: input.notes,
      sent_copy: { sentAt: new Date().toISOString(), order: input.orders[0], notes: input.notes, bank: input.bank } }] }) } as unknown as pg.Pool);
    const loaded = await repo.findQuote(lane, "logistics", "quote");
    for (const notes of [loaded?.notes, loaded?.sentQuote?.notes]) {
      assert.equal(notes?.freight.basis, "item");
      assert.deepEqual(notes?.freight.originalDetails, input.notes.freight.originalDetails);
      assert.deepEqual(notes?.logisticsFees, input.notes.logisticsFees);
    }
  }
});

test("item freight schema rejects invalid amounts and exchange rates", () => {
  for (const patch of [{ rate: -1 }, { weightKg: Infinity }, { vndRate: 0 }, { originalDetails: { currency: "USD", rate: -1 } }]) {
    const input = draft();
    Object.assign(input.notes.logisticsFees[0], patch);
    assert.equal(updateQuoteSchema.safeParse(input).success, false);
  }
});

test("switching away from item pricing keeps details without adding dormant item charges", () => {
  const sheet = draft();
  sheet.notes.freight.basis = "lump";
  sheet.notes.freight.total = 100;
  sheet.notes.freight.originalPrice = 80;
  assert.equal(sheet.notes.logisticsFees.length, 2);
  assert.deepEqual(logisticsQuoteFinancials(sheet), { cost: 2000000, revenue: 2500000, profit: 500000 });
  sheet.notes.freight.basis = "item";
  assert.equal(logisticsQuoteFinancials(sheet).revenue, 710000);
});

test("VND financials keep precision through currency conversion", () => {
  const sheet = draft();
  sheet.notes.logisticsFees[1].value = "60,001";
  assert.equal(quoteVndAmount(sheet, "logistics").vnd, 710004);
});

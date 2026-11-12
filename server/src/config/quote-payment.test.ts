import assert from "node:assert/strict";
import test from "node:test";
import type pg from "pg";
import { buildQuoteSheetModel, defaultQuoteBank, quotePaymentSummary, quoteVndAmount, updateQuoteSchema } from "@speego/shared";
import { PostgresCrmRepository } from "../adapters/postgres/crm.repository";
import { preserveQuotePrices, quoteDeskPatch } from "../services/quote-edit-policy";
import type { QuoteRecord } from "../repositories/crm.repository";

const draft = () => updateQuoteSchema.parse({
  templateId: null, opsNote: "", quoteStatus: "CHUA_CO_BAO_GIA", contractStatus: "CHUA_TAO",
  orders: [{ id: "00000000-0000-0000-0000-000000000001", name: "AUD quote", selected: true, currency: "AUD", lines: [] }],
  notes: { totalLabel: "", weightNote: "", validityNote: "", deposit: [],
    freight: { total: 100, totalManual: true, rate: null, currency: "AUD" },
    logisticsFees: [{ label: "Phí", labelEn: "Fee", value: "20", currency: "AUD" }],
    payment: { quoteCurrency: "AUD", currency: "VND", exchangeRate: 16000 } },
  bank: { custom: true, title: "", bankName: "Ngân hàng thử nghiệm", accountName: "Tài khoản thử nghiệm", accountNumber: "0123456789", routingNumber: "" },
});

test("AUD quotation remains AUD while payment is converted to VND, independent of the bank", () => {
  const input = draft();
  assert.equal(quotePaymentSummary(input)?.amount, 1_920_000);
  assert.equal(quotePaymentSummary({ ...input, notes: { ...input.notes, payment: { ...input.notes.payment!, currency: "AUD", exchangeRate: 16000 } } })?.amount, 120);
  assert.equal(input.orders[0].currency, "AUD");
  assert.equal(input.notes.freight.total, 100);
  for (const lang of ["vi", "en"] as const) {
    const model = buildQuoteSheetModel({ customer: { customerName: "Test", companyName: null, address: null, phone: null, email: null }, lines: [], currency: "AUD", notes: input.notes, bank: input.bank, lang }, { packagesSpec: () => "" });
    assert.equal(model.payment?.error, "");
    assert.match(model.payment!.rows[1][1], /^1 AUD = .* VND$/);
    assert.match(model.payment!.rows[2][1], /VND$/);
    assert.ok(model.bank.rows.some(([, value]) => value === "0123456789"));
    assert.ok(!model.bank.rows.some(([, value]) => value === defaultQuoteBank.routingNumber));
  }
});

test("payment validation rejects missing/nonpositive rates, incomplete accounts and mixed fee currencies", () => {
  const input = draft();
  for (const exchangeRate of [null, 0, -1, Infinity]) {
    assert.equal(updateQuoteSchema.safeParse({ ...input, notes: { ...input.notes, payment: { ...input.notes.payment, exchangeRate } } }).success, false);
  }
  assert.equal(updateQuoteSchema.safeParse({ ...input, bank: { ...input.bank, accountNumber: "" } }).success, false);
  input.notes.logisticsFees[0].currency = "USD";
  assert.ok(quotePaymentSummary(input)?.error);
  assert.equal(quotePaymentSummary(input)?.amount, null);
});

test("payment uses current draft, not a previously sent quotation, and rounds settlement currency", () => {
  const input = draft();
  const withSent = { ...input, sentQuote: { sentAt: "old", order: input.orders[0], notes: { ...input.notes, freight: { ...input.notes.freight, total: 1 } }, bank: input.bank } };
  assert.equal(quotePaymentSummary(withSent)?.amount, 1_920_000);
  input.notes.payment!.currency = "USD";
  input.notes.payment!.exchangeRate = 0.654321;
  assert.equal(quotePaymentSummary(input)?.amount, 78.52);
});

test("FCL accepts AUD and converts the total including optional charges", () => {
  const input = draft();
  input.notes.fcl = { to: "", pol: "", pod: "", etd: "", weight: "", volume: "", commodity: "", stuffingDate: "", notes: "", charges: [{ name: "Freight", rate: 200, quantity: 2, unit: "cont", vatAmount: 20, note: "", optional: true }] };
  const payment = quotePaymentSummary({ ...input, shippingMode: "SEA", logisticsClass: "FCL" });
  assert.equal(payment?.total, 420);
  assert.equal(payment?.amount, 6_720_000);
});

test("Logistics owns payment details; Sale content edits preserve them", () => {
  const stored = draft();
  const current = { ...stored, customerKind: "LOGISTICS" } as QuoteRecord;
  const input = structuredClone(stored);
  input.notes.payment!.exchangeRate = 17000;
  input.bank.accountNumber = "987654321";
  const patch = quoteDeskPatch("logistics", current, input);
  assert.equal(patch.notes.payment?.exchangeRate, 17000);
  assert.equal(patch.bank.accountNumber, "987654321");
  const sale = preserveQuotePrices(current, input);
  assert.deepEqual(sale.notes.payment, stored.notes.payment);
  assert.deepEqual(sale.bank, stored.bank);
});

test("repository loads payment and custom bank from draft and sent snapshot on both lanes", async () => {
  const input = draft();
  for (const lane of ["vn", "global"] as const) {
    const repository = new PostgresCrmRepository({ query: async () => ({ rowCount: 1, rows: [{
      customer_kind: "LOGISTICS", created_at: new Date(), order_lines: input.orders, common_notes: input.notes, bank_account: input.bank,
      sent_copy: { sentAt: new Date().toISOString(), order: input.orders[0], notes: input.notes, bank: input.bank },
    }] }) } as unknown as pg.Pool);
    const quote = await repository.findQuote(lane, "logistics", "quote");
    assert.deepEqual(quote?.notes.payment, input.notes.payment);
    assert.equal(quote?.bank.accountNumber, "0123456789");
    assert.equal(quote?.bank.routingNumber, "");
    assert.deepEqual(quote?.sentQuote?.notes.payment, input.notes.payment);
    assert.equal(quote?.sentQuote?.bank.routingNumber, "");
  }
});

test("repository retains logistics VND rates in draft and sent quotes on both lanes", async () => {
  for (const lane of ["vn", "global"] as const) {
    for (const amount of [327.5, 425.5]) {
      for (const vndRate of [25460, null]) {
        const input = draft();
        input.orders[0].currency = "VND";
        input.notes.freight = { ...input.notes.freight, total: amount, currency: "USD", vndRate };
        input.notes.logisticsFees = [];
        const repository = new PostgresCrmRepository({ query: async () => ({ rowCount: 1, rows: [{
          customer_kind: "LOGISTICS", created_at: new Date(), order_lines: input.orders, common_notes: input.notes,
          sent_copy: { sentAt: new Date().toISOString(), order: input.orders[0], notes: input.notes, bank: input.bank },
        }] }) } as unknown as pg.Pool);
        const quote = await repository.findQuote(lane, "logistics", "quote");
        assert.ok(quote);
        assert.equal(quote.notes.freight.vndRate, vndRate);
        assert.equal(quote.sentQuote?.notes.freight.vndRate, vndRate);
        const expected = vndRate == null ? null : amount * vndRate;
        assert.equal(quoteVndAmount(quote, "logistics").vnd, expected);
        assert.equal(quoteVndAmount({ ...quote, sentQuote: null }, "logistics").vnd, expected);
      }
    }
  }
});

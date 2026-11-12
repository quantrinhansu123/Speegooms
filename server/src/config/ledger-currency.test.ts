import assert from "node:assert/strict";
import { test } from "node:test";
import { createLedgerEntrySchema, createStatementSchema, createReceivingAccountSchema, ledgerIncomeInCurrency, ledgerAmountVnd, ledgerMatchesStatement } from "@speego/shared";

const input = { date: "2026-11-11", kind: "THU", category: "THU_KHACH", counterparty: "Test", amount: 100 };
test("receiving accounts and transaction dates validate independently of bookkeeping dates", () => {
  const parsed = createLedgerEntrySchema.parse({ ...input, transactionDate: "2026-10-30", receivingAccount: " Bank · 00123 · SPEEGO " });
  assert.equal(parsed.date, "2026-11-11");
  assert.equal(parsed.transactionDate, "2026-10-30");
  assert.equal(parsed.receivingAccount, "Bank · 00123 · SPEEGO");
  assert.equal(createLedgerEntrySchema.parse(input).transactionDate, undefined);
  assert.equal(createLedgerEntrySchema.parse({ ...input, transactionDate: null }).transactionDate, null);
  for (const transactionDate of ["2026-02-30", "bad", "2026-13-01"]) {
    assert.equal(createLedgerEntrySchema.safeParse({ ...input, transactionDate }).success, false);
  }
  for (const name of [" ", "x".repeat(201)]) assert.equal(createReceivingAccountSchema.safeParse({ name }).success, false);
});
test("foreign income sums original amounts by currency without expenses or floating point drift", () => {
  const rows = [
    { kind: "THU", currency: "USD", amount: 0.1 }, { kind: "THU", currency: "USD", amount: 0.2 },
    { kind: "CHI", currency: "USD", amount: 100 }, { kind: "THU", currency: "AUD", amount: 42.5 },
    { kind: "THU", currency: "VND", amount: 1000000 },
  ];
  assert.equal(ledgerIncomeInCurrency(rows, "USD"), 0.3);
  assert.equal(ledgerIncomeInCurrency(rows, "AUD"), 42.5);
  assert.equal(ledgerIncomeInCurrency(rows, "EUR"), 0);
  assert.equal(ledgerIncomeInCurrency([], "USD"), 0);
});
test("legacy VND and foreign-currency validation", () => {
  assert.equal(createLedgerEntrySchema.parse(input).currency, "VND");
  for (const schema of [createLedgerEntrySchema, createStatementSchema]) {
    assert.equal(schema.safeParse({ ...input, currency: "USD" }).success, false);
    for (const exchangeRate of [0, -1, Infinity, 0.0000001]) {
      assert.equal(schema.safeParse({ ...input, currency: "USD", exchangeRate }).success, false);
    }
    assert.equal(schema.safeParse({ ...input, currency: "VND", exchangeRate: 2 }).success, false);
    assert.equal(schema.safeParse({ ...input, currency: "USD", exchangeRate: 25500 }).success, true);
    assert.equal(schema.safeParse({ ...input, currency: "USD", exchangeRate: 1000000, amount: 9999999999999 }).success, false);
  }
  assert.equal(ledgerAmountVnd({ currency: "USD", exchangeRate: 25500, amount: 100 }), 2550000);
  assert.equal(ledgerAmountVnd({ currency: "USD", exchangeRate: 25500.5, amount: 1 }), 25501);
  assert.equal(ledgerAmountVnd({ currency: "USD", exchangeRate: 50, amount: 0.29 }), 15);
});
test("reconciliation compares VND conversion or identical foreign currency, kind and order", () => {
  const ledger = { kind: "THU", currency: "USD", amount: 100, amountVnd: 2550000, orderCode: "HD-1" };
  const statement = { kind: "THU", currency: "VND", amount: 2550000, orderCode: null };
  assert.equal(ledgerMatchesStatement(ledger, statement), true);
  assert.equal(ledgerMatchesStatement(ledger, { ...statement, amount: 100 }), false);
  assert.equal(ledgerMatchesStatement(ledger, { ...statement, currency: "USD", amount: 100 }), true);
  assert.equal(ledgerMatchesStatement(ledger, { ...statement, currency: "EUR", amount: 100 }), false);
  assert.equal(ledgerMatchesStatement(ledger, { ...statement, kind: "CHI" }), false);
  assert.equal(ledgerMatchesStatement(ledger, { ...statement, orderCode: "HD-2" }), false);
});

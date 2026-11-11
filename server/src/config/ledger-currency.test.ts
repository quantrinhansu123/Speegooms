import assert from "node:assert/strict";
import { test } from "node:test";
import { createLedgerEntrySchema, createStatementSchema, ledgerAmountVnd, ledgerMatchesStatement } from "@speego/shared";

const input = { date: "2026-11-11", kind: "THU", category: "THU_KHACH", counterparty: "Test", amount: 100 };
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

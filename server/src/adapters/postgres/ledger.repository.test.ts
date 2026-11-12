import assert from "node:assert/strict";
import { test } from "node:test";
import pg from "pg";
import { readFile } from "node:fs/promises";
import { config } from "dotenv";
import { createLedgerEntrySchema, createStatementSchema } from "@speego/shared";
import { PostgresLedgerRepository } from "./ledger.repository";

test("Postgres ledger currency roundtrip, reconciliation and locking (rolled back)", { skip: process.env.LEDGER_DB_TEST !== "1" }, async () => {
  config({ path: new URL("../../../.env", import.meta.url), quiet: true });
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false });
  await client.connect();
  await client.query("begin");
  if (!(await client.query("select to_regclass('ke_toan.tai_khoan_nhan') as name")).rows[0].name) {
    await client.query(await readFile(new URL("../../../db/migrations/050_ledger_receiving_accounts.sql", import.meta.url), "utf8"));
  }
  // Keep repository transactions inside the test's rollback boundary.
  const query = (sql: string, values?: unknown[]) => client.query(
    sql === "begin" ? "savepoint ledger_test" : sql === "commit" ? "release savepoint ledger_test" : sql === "rollback" ? "rollback to savepoint ledger_test" : sql,
    values,
  );
  const repository = new PostgresLedgerRepository({ query, connect: async () => ({ query, release() {} }) } as unknown as pg.Pool);
  try {
    const account = await repository.createReceivingAccount("Test Bank · 000123 · rollback");
    assert.equal(await repository.createReceivingAccount(account), account);
    assert.ok((await repository.listReceivingAccounts()).includes(account));
    const orders = await repository.listLedgerOrders();
    const input = createLedgerEntrySchema.parse({ date: "2026-11-11", kind: "THU", category: "THU_KHACH", counterparty: "Currency test rollback", amount: 100, currency: "USD", exchangeRate: 25500, orderCode: orders[0]?.code });
    const entry = await repository.createLedger({ ...input, receivingAccount: account, transactionDate: "2026-10-30" });
    assert.equal(entry.date, input.date);
    assert.equal(entry.transactionDate, "2026-10-30");
    assert.equal(entry.receivingAccount, account);
    assert.equal(entry.amountVnd, 2550000);
    assert.equal(entry.currency, "USD");
    if (orders[0]) assert.equal(entry.customerName, orders[0].customerName);
    const updated = await repository.updateLedger(entry.id, { ...input, exchangeRate: 26000 });
    assert.equal(updated.transactionDate, "2026-10-30");
    assert.equal(updated.receivingAccount, account);
    const cleared = await repository.updateLedger(entry.id, { ...input, exchangeRate: 26000, receivingAccount: null, transactionDate: null });
    assert.equal(cleared.transactionDate, null);
    assert.equal(cleared.receivingAccount, null);
    await assert.rejects(repository.createLedger({ ...input, receivingAccount: "missing-account" }));
    assert.equal(updated.amountVnd, 2600000);
    assert.equal((await repository.listLedger()).find(row => row.id === entry.id)?.exchangeRate, 26000);
    const wrong = await repository.createStatement(createStatementSchema.parse({ ...input, currency: "EUR", exchangeRate: 26000 }));
    await assert.rejects(repository.reconcileLedger(entry.id, wrong.id));
    const statement = await repository.createStatement(createStatementSchema.parse({ ...input, amount: 2600000, currency: "VND", exchangeRate: 1 }));
    const reconciled = await repository.reconcileLedger(entry.id, statement.id);
    assert.equal(reconciled.reconciled, true);
    assert.equal((await repository.listStatements()).find(row => row.id === statement.id)?.ledgerId, entry.id);
    await assert.rejects(repository.updateLedger(entry.id, input));
    await assert.rejects(repository.deleteLedger(entry.id));
    const removable = await repository.createLedger(input);
    await repository.deleteLedger(removable.id);
    assert.equal((await repository.listLedger()).some(row => row.id === removable.id), false);
  } finally {
    await client.query("rollback");
    await client.end();
  }
});

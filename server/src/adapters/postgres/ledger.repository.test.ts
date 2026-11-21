import assert from "node:assert/strict";
import { test } from "node:test";
import pg from "pg";
import { config } from "dotenv";
import { createLedgerEntrySchema, createStatementSchema } from "@speego/shared";
import { PostgresLedgerRepository } from "./ledger.repository";

test("Postgres ledger currency roundtrip, reconciliation and locking (rolled back)", { skip: process.env.LEDGER_DB_TEST !== "1" }, async () => {
  config({ path: new URL("../../../.env", import.meta.url), quiet: true });
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false });
  await client.connect();
  await client.query("begin");
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
    const { rows: orders } = await repository.pageLedgerOrders("", { page: 1, pageSize: 20 });
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

    await client.query(`insert into crm.hop_dong (ma_hien_thi, ten_khach_hang, tao_luc)
      select 'HD-ACC-FIXTURE-' || n, case when n <= 2 then 'Đặng Minh Test' else 'Other customer' end,
        case when n <= 2 then '2001-01-01'::timestamptz else now() end
      from generate_series(1, 503) n`);
    const matching = await repository.pageLedgerOrders("dang minh test", { page: 1, pageSize: 1 });
    assert.equal(matching.pagination.total, 2);
    const next = await repository.pageLedgerOrders("dang minh test", { page: 2, pageSize: 1 });
    assert.notEqual(matching.rows[0].code, next.rows[0].code);
    assert.equal((await repository.pageLedgerOrders(matching.rows[0].code, { page: 1, pageSize: 1 })).rows[0].id, matching.rows[0].id);

    const base = { date: "2099-11-01", transactionDate: "2099-10-31", counterparty: "Ledger report fixture",
      currency: "VND", exchangeRate: 1, receivingAccount: account };
    await repository.createLedger(createLedgerEntrySchema.parse({ ...base, kind: "THU", category: "THU_KHACH", orderCode: matching.rows[0].code, amount: 900 }));
    await repository.createLedger(createLedgerEntrySchema.parse({ ...base, kind: "CHI", category: "CHI_XUONG", orderCode: next.rows[0].code, amount: 500 }));
    const internalInput = createLedgerEntrySchema.parse({ ...base, kind: "CHI", category: "CHI_NOI_BO", amount: 150,
      department: "ke-toan", item: "Lương", content: "Chi lương kỳ 10" });
    const internal = await repository.createLedger(internalInput);
    const edited = await repository.updateLedger(internal.id, { ...internalInput, content: "Chi lương" });
    assert.equal(edited.content, "Chi lương");
    const internalIncome = await repository.createLedger(createLedgerEntrySchema.parse({ ...base, kind: "THU", category: "THU_NOI_BO", amount: 200,
      receivingAccount: null, transactionDate: null, department: "ke-toan", item: "Hoàn ứng", content: "Tiền thừa" }));
    const internalStatement = await repository.createStatement(createStatementSchema.parse(internalInput));
    const orderStatement = await repository.createStatement(createStatementSchema.parse({ ...internalInput, orderCode: matching.rows[0].code }));
    const page = { page: 1, pageSize: 20 };
    assert.deepEqual((await repository.pageStatements(page, internal.id)).rows.map(row => row.id), [internalStatement.id]);
    await assert.rejects(repository.reconcileLedger(internal.id, orderStatement.id), /Khoản nội bộ/);
    assert.equal((await repository.reconcileLedger(internal.id, internalStatement.id)).reconciled, true);

    const search = { q: "Ledger report fixture", from: "", to: "", kind: "", category: "", dateField: "transaction", counterparty: "" };
    const { rows: report } = await repository.pageLedgerReport(search, "month-customer", page);
    assert.equal(report.length, 3);
    const customer = report.find(row => row.customerName === "Đặng Minh Test");
    assert.ok(customer?.customerKey);
    assert.equal(customer.month, "2099-10");
    assert.equal(customer.entryCount, 2);
    assert.equal(Number(customer.income), 900);
    assert.equal(Number(customer.expense), 500);
    assert.equal(Number(customer.balance), 400);
    assert.deepEqual(report.filter(row => row.customerKey === "unassigned").map(row => row.month), ["2099-10", null]);
    const drilldown = await repository.pageLedger({ ...search, reportMonth: customer.month, customerKey: customer.customerKey }, page);
    assert.equal(drilldown.pagination.total, 2);
    assert.equal(Number(drilldown.pagination.summary.chi), 500);
    const missing = await repository.pageLedger({ ...search, receivingAccount: "missing", reportMonth: "missing", internal: true }, page);
    assert.deepEqual(missing.rows.map(row => row.id), [internalIncome.id]);
    const accountReport = await repository.pageLedgerReport({ ...search, receivingAccount: `name:${account}` }, "month", page);
    assert.equal(accountReport.rows.length, 1);
    assert.equal(Number(accountReport.rows[0].balance), 250);
  } finally {
    await client.query("rollback");
    await client.end();
  }
});

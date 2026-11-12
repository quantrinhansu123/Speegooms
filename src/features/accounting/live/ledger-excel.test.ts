import assert from "node:assert/strict";
import { test } from "node:test";
import { buildLedgerWorkbook, readLedgerWorkbook, unchangedLedgerRow, ledgerExcelLimit, type ExcelLedgerEntry } from "./ledger-excel";

const entry: ExcelLedgerEntry = {
  id: "00000000-0000-4000-8000-000000000001", date: "2026-11-12", kind: "CHI", category: "CHI_KHAC",
  counterparty: "Công ty thử nghiệm", orderCode: null, amount: 100.29, currency: "USD", exchangeRate: 25000.123456,
  reference: "000123", reconciled: false,
};
async function read(workbook: Awaited<ReturnType<typeof buildLedgerWorkbook>>) {
  const buffer = await workbook.xlsx.writeBuffer();
  return readLedgerWorkbook(Uint8Array.from(new Uint8Array(buffer)).buffer);
}

test("export/import preserves IDs, amounts, currency, rate and optional order", async () => {
  const workbook = await buildLedgerWorkbook([entry, { ...entry, id: "00000000-0000-4000-8000-000000000002", kind: "THU", category: "COC_KHACH", currency: "VND", exchangeRate: 1 }]);
  const result = await read(workbook);
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0].id, entry.id);
  assert.equal(result.rows[0].input.reference, "000123");
  assert.ok(unchangedLedgerRow(result.rows[0].input, entry));
  assert.ok(!unchangedLedgerRow({ ...result.rows[0].input, amount: 101 }, entry));
  assert.equal(result.rows[1].input.kind, "THU");
  assert.equal(result.rows[1].input.currency, "VND");
});

test("new Excel fields roundtrip and old files preserve existing account and transaction date", async () => {
  const current = { ...entry, receivingAccount: "Bank · 000123 · SPEEGO", transactionDate: "2026-11-01" };
  const workbook = await buildLedgerWorkbook([current]);
  const result = await read(workbook);
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows[0].input.receivingAccount, current.receivingAccount);
  assert.equal(result.rows[0].input.transactionDate, "2026-11-01");
  assert.equal(result.rows[0].input.date, "2026-11-12");
  assert.ok(unchangedLedgerRow(result.rows[0].input, current));
  const sheet = workbook.getWorksheet("Thu chi")!;
  sheet.getCell("N2").value = new Date("2026-10-30T00:00:00Z");
  sheet.getCell("N2").numFmt = "yyyy-mm-dd";
  assert.equal((await read(workbook)).rows[0].input.transactionDate, "2026-10-30");
  sheet.getCell("N2").value = "2026-02-30";
  assert.equal((await read(workbook)).errors.length, 1);
  sheet.getCell("M2").value = null;
  sheet.getCell("N2").value = null;
  const cleared = (await read(workbook)).rows[0].input;
  assert.equal(cleared.receivingAccount, null);
  assert.equal(cleared.transactionDate, null);
  assert.equal(unchangedLedgerRow(cleared, current), false);
  sheet.spliceColumns(13, 2);
  const legacy = (await read(workbook)).rows[0].input;
  assert.equal(legacy.receivingAccount, undefined);
  assert.equal(legacy.transactionDate, undefined);
  assert.ok(unchangedLedgerRow(legacy, current));
});

test("new optional Excel columns reject duplicate headers and formula accounts", async () => {
  const workbook = await buildLedgerWorkbook([entry]);
  const sheet = workbook.getWorksheet("Thu chi")!;
  sheet.getCell("O1").value = "Tài khoản nhận";
  await assert.rejects(read(workbook), /Trùng cột Tài khoản nhận/);
  sheet.getCell("O1").value = null;
  sheet.getCell("M2").value = { formula: '"Bank"', result: "Bank" };
  assert.match((await read(workbook)).errors[0], /công thức/);
});

test("template accepts new rows, Excel dates and VND defaults", async () => {
  const workbook = await buildLedgerWorkbook();
  const sheet = workbook.getWorksheet("Thu chi")!;
  sheet.addRow(["", new Date("2026-11-12T00:00:00Z"), "Thu", "Cọc khách", "Khách mới", "", 500000]);
  sheet.getCell("B2").numFmt = "yyyy-mm-dd";
  const result = await read(workbook);
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows[0].id, "");
  assert.equal(result.rows[0].input.date, "2026-11-12");
  assert.equal(result.rows[0].input.currency, "VND");
});

test("rejects bad dates, money, categories, rates and formula cells per row", async () => {
  const workbook = await buildLedgerWorkbook(Array.from({ length: 7 }, () => ({ ...entry, id: "" })));
  const sheet = workbook.getWorksheet("Thu chi")!;
  sheet.getCell("B2").value = "2026-02-30";
  sheet.getCell("G3").value = -1;
  sheet.getCell("C4").value = "Thu";
  sheet.getCell("I5").value = null;
  sheet.getCell("G6").value = { formula: "1+1", result: 2 };
  sheet.getCell("G7").value = "1,000";
  sheet.getCell("E8").value = { text: "Đối tượng", hyperlink: "https://example.com" };
  const result = await read(workbook);
  assert.equal(result.rows.length, 0);
  assert.equal(result.errors.length, 7);
  assert.match(result.errors[0], /Dòng 2/);
  assert.match(result.errors[4], /công thức/);
});

test("duplicate or invalid IDs are never treated as new rows", async () => {
  const workbook = await buildLedgerWorkbook([entry, entry, { ...entry, id: "not-an-id" }]);
  const result = await read(workbook);
  assert.equal(result.rows.length, 1);
  assert.equal(result.errors.length, 2);
  assert.match(result.errors[0], /trùng/);
  assert.match(result.errors[1], /không hợp lệ/);
});

test("requires the expected sheet, unique headers and non-empty data", async () => {
  const workbook = await buildLedgerWorkbook();
  await assert.rejects(read(workbook), /chưa có dữ liệu/);
  workbook.getWorksheet("Thu chi")!.getCell("A1").value = "Sai cột";
  await assert.rejects(read(workbook), /Mã dòng/);
  workbook.removeWorksheet("Thu chi");
  await assert.rejects(read(workbook), /Thiếu sheet/);
});

test("limits bulk input and ignores read-only reconciliation columns", async () => {
  const workbook = await buildLedgerWorkbook([{ ...entry, reconciled: true }]);
  workbook.getWorksheet("Thu chi")!.getCell("L2").value = "Chờ đối soát";
  const result = await read(workbook);
  assert.ok(!("reconciled" in result.rows[0].input));
  assert.ok(unchangedLedgerRow(result.rows[0].input, { ...entry, reconciled: true }));
  workbook.getWorksheet("Thu chi")!.getCell(`A${ledgerExcelLimit + 2}`).value = "too-many";
  await assert.rejects(read(workbook), /Tối đa/);
});

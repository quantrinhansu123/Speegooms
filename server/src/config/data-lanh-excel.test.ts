import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import pg from "pg";
import { readFile } from "node:fs/promises";
import type { Request, Response } from "express";
import express from "express";
import type { AddressInfo } from "node:net";
import type { AppContainer } from "../container";
import { dataLanhRoutes } from "../routes/data-lanh.routes";
import { errorHandler } from "../middlewares/error-handler";
import type { CreateDataLanhInput, DataLanhRecord } from "@speego/shared";
import { dataLanhWorkbook, importDataLanhWorkbook } from "../services/data-lanh-excel";
import { PostgresDataLanhRepository } from "../adapters/postgres/data-lanh.repository";
import { DataLanhController } from "../controllers/data-lanh.controller";
import { AppError } from "../lib/errors";
import { can } from "./permissions";

async function sample() {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await dataLanhWorkbook([]) as unknown as Parameters<typeof book.xlsx.load>[0]);
  return book;
}
const buffer = async (book: ExcelJS.Workbook) => Buffer.from(await book.xlsx.writeBuffer());

test("template imports new customers, preserves leading zero and reports invalid/duplicate rows", async () => {
  const book = await sample();
  const sheet = book.worksheets[0];
  sheet.addRow([null, null, "Alice", "Shop", "0900123456"]);
  sheet.addRow([null, null, "Duplicate", null, "+84 900"]);
  sheet.addRow([null, null, null, "Missing name and phone"]);
  sheet.addRow([null, null, "Invalid class", null, null, null, null, null, "Wrong class"]);
  sheet.addRow(["existing-id", 1, "Existing without phone"]);
  const inputs: CreateDataLanhInput[] = [];
  const result = await importDataLanhWorkbook(await buffer(book), async rows => {
    inputs.push(...rows);
    return { created: 1, skipped: 1 };
  });
  assert.equal(result.created, 1);
  assert.equal(result.skipped, 2);
  assert.equal(result.errorCount, 2);
  assert.deepEqual(result.errors.map(error => error.row), [4, 5]);
  assert.equal(inputs[0].phone, "0900123456");
  assert.equal(inputs[0].company, "Shop");
  assert.ok(!("internId" in inputs[0]));
});

test("invalid files and headers fail before any write", async () => {
  let writes = 0;
  const create = async () => { writes++; return { created: 0, skipped: 0 }; };
  await assert.rejects(importDataLanhWorkbook(Buffer.from("not Excel"), create), { status: 422 });
  const book = new ExcelJS.Workbook();
  book.addWorksheet("Other").addRow(["Unknown"]);
  await assert.rejects(importDataLanhWorkbook(await buffer(book), create), { status: 422 });
  assert.equal(writes, 0);
});

test("import rejects more than 5000 rows before writing and caps row errors", async () => {
  const book = await sample();
  for (let i = 0; i < 5001; i++) book.worksheets[0].addRow([null, null, `Customer ${i}`]);
  await assert.rejects(importDataLanhWorkbook(await buffer(book), async () => { assert.fail("must not write"); }), { status: 422 });
  const invalid = await sample();
  for (let i = 0; i < 55; i++) invalid.worksheets[0].addRow([null, null, null, "Company only"]);
  const result = await importDataLanhWorkbook(await buffer(invalid), async () => { assert.fail("invalid row"); });
  assert.equal(result.errorCount, 55);
  assert.equal(result.errors.length, 50);
});

test("exported existing records round-trip without duplicate inserts even without a phone", async () => {
  const bytes = await dataLanhWorkbook([{ id: "existing", stt: 4, fullName: "Existing", phone: null, internName: "Sale", facebookStatus: "Status" } as DataLanhRecord]);
  const result = await importDataLanhWorkbook(bytes, async () => { assert.fail("existing ID must be skipped"); });
  assert.equal(result.skipped, 1);
  assert.equal(result.created, 0);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(bytes as unknown as Parameters<typeof book.xlsx.load>[0]);
  assert.equal(book.worksheets[0].getCell("N2").value, "Sale");
});

test("failed import does not expose database details", async () => {
  const book = await sample();
  book.worksheets[0].addRow([null, null, "First"]);
  book.worksheets[0].addRow([null, null, "Second"]);
  await assert.rejects(importDataLanhWorkbook(await buffer(book), async () => {
    throw new Error("private database credentials");
  }), error => error instanceof AppError && error.status === 503 && !error.message.includes("private"));
});

test("create/import permissions allow Sales while assignment and deletion stay Admin only", () => {
  for (const role of ["admin", "sale-vn", "sale-global"] as const) assert.equal(can(role, "datalanh.create"), true);
  for (const role of ["ban-gd", "sale-intern", "sourcing", "ke-toan"] as const) assert.equal(can(role, "datalanh.create"), false);
  for (const role of ["sale-vn", "sale-global"] as const) {
    assert.equal(can(role, "datalanh.assign"), false);
    assert.equal(can(role, "datalanh.delete"), false);
  }
});

test("repository serializes duplicate check and STT allocation, assigns creator, and rolls back duplicate phone", async () => {
  for (const duplicate of [false, true]) {
    const calls: { sql: string; params: unknown[] }[] = [];
    let released = false;
    const client = {
      async query(sql: string, params: unknown[] = []) {
        calls.push({ sql, params });
        if (sql.includes("regexp_replace")) return { rows: duplicate ? [{ stt: 1, name: "Hidden customer" }] : [] };
        return { rows: [{ id: "id", stt: 1, intern_id: "sale-1", assigned_at: null, handed_over_at: null }] };
      },
      release() { released = true; },
    };
    const repo = new PostgresDataLanhRepository({ connect: async () => client } as unknown as pg.Pool);
    if (duplicate) {
      await assert.rejects(repo.create({ phone: "+84 900" }, "sale-1"), error => error instanceof AppError && error.status === 409 && !error.message.includes("Hidden"));
      assert.equal(calls.at(-1)?.sql, "rollback");
      assert.ok(!calls.some(call => call.sql.startsWith("insert")));
    } else {
      const row = await repo.create({ fullName: "Customer", phone: "+84 900" }, "sale-1");
      assert.equal(row.internId, "sale-1");
      assert.equal(calls.find(call => call.sql.startsWith("insert"))?.params[0], "sale-1");
      assert.equal(calls.at(-1)?.sql, "commit");
    }
    assert.equal(calls[0].sql, "begin");
    assert.match(calls[1].sql, /pg_advisory_xact_lock/);
    assert.deepEqual(calls.find(call => call.sql.includes("regexp_replace"))?.params, ["84900"]);
    assert.equal(released, true);
  }
});

test("controller scopes create/export to authenticated user and exports without list truncation", async () => {
  for (const role of ["admin", "ban-gd", "sale-vn", "sale-global", "sale-intern"] as const) {
    const calls: unknown[][] = [];
    const repo = { list: async (...args: unknown[]) => { calls.push(args); return []; }, create: async (...args: unknown[]) => { calls.push(args); return {}; } };
    const controller = new DataLanhController(repo as unknown as PostgresDataLanhRepository);
    const req = { user: { id: "sale-1", role }, query: {}, body: { fullName: "Customer", internId: "forged" } } as unknown as Request;
    const res = { setHeader() {}, status() { return this; }, send() {}, json() {} } as unknown as Response;
    await controller.exportExcel(req, res);
    const owner = role === "admin" || role === "ban-gd" ? null : "sale-1";
    assert.deepEqual(calls[0], [owner, null]);
    if (role === "admin" || role === "sale-vn" || role === "sale-global") {
      await controller.create(req, res);
      assert.equal(calls[1][1], owner);
    }
  }
});

test("HTTP endpoints enforce permissions, strip forged assignment, and keep export scoped", async () => {
  const creates: { input: CreateDataLanhInput; owner: string | null }[] = [];
  const scopes: unknown[][] = [];
  const repo = {
    create: async (input: CreateDataLanhInput, owner: string | null) => { creates.push({ input, owner }); return { id: "new" }; },
    importRows: async (inputs: CreateDataLanhInput[], owner: string | null) => { creates.push(...inputs.map(input => ({ input, owner }))); return { created: inputs.length, skipped: 0 }; },
    list: async (...args: unknown[]) => { scopes.push(args); return []; },
  };
  const app = express();
  app.use(express.json());
  app.use("/api/data-lanh", dataLanhRoutes({
    authenticate: (req, _res, next) => {
      if (!req.headers["x-role"]) return next(new AppError(401, "UNAUTHENTICATED", "Chưa đăng nhập"));
      req.user = { id: "sale-1", role: req.headers["x-role"] } as NonNullable<Request["user"]>;
      next();
    },
    dataLanhController: new DataLanhController(repo as unknown as PostgresDataLanhRepository),
  } as AppContainer));
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/data-lanh`;
  try {
    assert.equal((await fetch(`${url}/export`)).status, 401);
    for (const role of ["ban-gd", "sale-intern", "sourcing"]) {
      const headers = { "x-role": role, "content-type": "application/json" };
      assert.equal((await fetch(url, { method: "POST", headers, body: JSON.stringify({ fullName: "Customer" }) })).status, 403);
      assert.equal((await fetch(`${url}/import`, { method: "POST", headers, body: "{}" })).status, 403);
    }
    const created = await fetch(url, { method: "POST", headers: { "x-role": "sale-vn", "content-type": "application/json" },
      body: JSON.stringify({ fullName: "Customer", internId: "other-user", saleCareId: "other-user" }) });
    assert.equal(created.status, 201);
    assert.deepEqual(creates[0], { input: { fullName: "Customer" }, owner: "sale-1" });
    const book = await sample();
    book.worksheets[0].addRow([null, null, "Imported", null, "0900123456"]);
    const imported = await fetch(`${url}/import`, { method: "POST", headers: { "x-role": "sale-global", "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }, body: await buffer(book) });
    assert.equal(imported.status, 200);
    assert.equal((await imported.json()).created, 1);
    assert.equal(creates[1].owner, "sale-1");
    const exported = await fetch(`${url}/export`, { headers: { "x-role": "sale-vn" } });
    assert.equal(exported.status, 200);
    assert.match(exported.headers.get("content-type")!, /spreadsheetml/);
    assert.deepEqual(scopes, [["sale-1", null]]);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test("Postgres bulk import deduplicates phones, rolls back failures, scopes export and serializes concurrent creates", { skip: !process.env.DATA_LANH_TEST_URL }, async () => {
  const url = new URL(process.env.DATA_LANH_TEST_URL!);
  assert.ok(["127.0.0.1", "localhost"].includes(url.hostname));
  assert.equal(url.pathname, "/data_lanh_excel_test");
  const pool = new pg.Pool({ connectionString: url.toString() });
  try {
    await pool.query("create schema crm; create table public.nguoi_dung (ma_nguoi_dung text primary key, ho_ten text, vai_tro text)");
    for (const file of ["044_data_lanh.sql", "045_data_lanh_ban_giao_sale.sql", "046_data_lanh_nguoi_nhan.sql"]) {
      await pool.query(await readFile(new URL(`../../db/migrations/${file}`, import.meta.url), "utf8"));
    }
    await pool.query("insert into public.nguoi_dung values ('sale-a', 'Sale A', 'sale-vn'), ('sale-b', 'Sale B', 'sale-global'), ('intern-a', 'Intern A', 'sale-intern'), ('intern-b', 'Intern B', 'sale-intern')");
    const repo = new PostgresDataLanhRepository(pool);
    await repo.create({ fullName: "Existing", phone: "0900-123" }, "sale-b");
    assert.deepEqual(await repo.importRows([
      { fullName: "Existing phone", phone: "0900 123" }, { fullName: "First", phone: "0900456" },
      { fullName: "Duplicate in file", phone: "0900-456" }, { fullName: "No phone A" }, { fullName: "No phone B" },
    ], "sale-a"), { created: 3, skipped: 2 });
    assert.equal((await repo.list("sale-a", null)).length, 3);
    assert.equal((await repo.list("sale-b", null)).length, 1);
    assert.equal((await repo.list(null, 2)).length, 2);
    assert.equal((await repo.list(null, null)).length, 4);
    await assert.rejects(repo.importRows([{ fullName: "Rollback" }], "missing-user"));
    assert.equal((await repo.list(null, null)).length, 4);
    const concurrent = await Promise.allSettled([
      repo.create({ fullName: "Concurrent A", phone: "099999" }, "sale-a"),
      repo.importRows([{ fullName: "Concurrent B", phone: "099999" }], "sale-b"),
    ]);
    assert.ok(concurrent.some(result => result.status === "fulfilled"));
    const all = await repo.list(null, null);
    assert.equal(all.filter(row => row.phone === "099999").length, 1);
    assert.equal(new Set(all.map(row => row.stt)).size, all.length);
    await pool.query("insert into crm.data_lanh_nguoi_nhan values ('intern-a', 1), ('intern-b', 2)");
    await repo.create({ fullName: "Admin unassigned" });
    assert.deepEqual(await repo.assignRoundRobin(), { assigned: 1, interns: 2 });
    await repo.create({ fullName: "Sale own" }, "sale-a");
    await repo.create({ fullName: "Admin next" });
    assert.deepEqual(await repo.assignRoundRobin(), { assigned: 1, interns: 2 });
    assert.equal((await repo.list("intern-b", null))[0]?.fullName, "Admin next");
  } finally {
    await pool.end();
  }
});

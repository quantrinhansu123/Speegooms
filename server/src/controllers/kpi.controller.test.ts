import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";
import pg from "pg";
import { createKpiSchema, manageableKpiDepartments, roleSchema, type CreateKpiInput, type KpiDefinition, type KpiDepartment, type Role, type UpdateKpiInput } from "@speego/shared";
import { PostgresKpiRepository } from "../adapters/postgres/kpi.repository";
import { KpiController } from "./kpi.controller";

const input: CreateKpiInput = { department: "marketing", group: "Content", code: "KPI_1_C_MKT", name: "Lượt xem", unit: "Lượt", target: null, period: "month", active: true };
const id = "71b70aa7-1e66-48ed-b77a-048aa40a5151";
const row: KpiDefinition = { ...input, id, version: 1 };
const req = (role?: Role, body: unknown = input, query = {}) => ({ user: role ? { id: "manager", role } : undefined, body, query, params: { id } }) as unknown as Request;
function response() {
  let body: unknown;
  let status = 200;
  const res = { status(value: number) { status = value; return this; }, json(value: unknown) { body = value; } } as unknown as Response;
  return { res, body: () => body, status: () => status };
}
function repository(overrides = {}) {
  const scopes: (readonly KpiDepartment[])[] = [];
  const writes: unknown[] = [];
  const repo = {
    list: async (departments: readonly KpiDepartment[]) => { scopes.push(departments); return [row]; },
    create: async (data: CreateKpiInput, actorId: string) => { writes.push([data, actorId]); return { ...data, id, version: 1 }; },
    update: async (key: string, data: UpdateKpiInput, actorId: string) => { writes.push([key, data, actorId]); return { ...data, id: key, version: data.version + 1 }; },
    ...overrides,
  } as unknown as PostgresKpiRepository;
  return { repo, scopes, writes };
}

test("only admin, directors and Marketing lead can read or write KPI settings", async () => {
  for (const role of roleSchema.options) {
    const controller = new KpiController(repository().repo);
    const r = response();
    if (["admin", "ban-gd", "marketing-lead"].includes(role)) {
      await controller.list(req(role), r.res);
      await controller.create(req(role), r.res);
      await controller.update(req(role, { ...input, version: 1 }), r.res);
    } else {
      await assert.rejects(controller.list(req(role), r.res), { status: 403 });
      await assert.rejects(controller.create(req(role), r.res), { status: 403 });
      await assert.rejects(controller.update(req(role, { ...input, version: 1 }), r.res), { status: 403 });
    }
  }
  await assert.rejects(new KpiController(null).list(req(), response().res), { status: 401 });
});

test("Marketing lead is department-scoped on reads and all writes", async () => {
  const d = repository();
  const controller = new KpiController(d.repo);
  const r = response();
  await controller.list(req("marketing-lead"), r.res);
  assert.deepEqual(d.scopes, [["marketing"]]);
  for (const department of manageableKpiDepartments("admin").filter(value => value !== "marketing")) {
    await assert.rejects(controller.list(req("marketing-lead", {}, { department }), r.res), { status: 403 });
    await assert.rejects(controller.create(req("marketing-lead", { ...input, department }), r.res), { status: 403 });
    await assert.rejects(controller.update(req("marketing-lead", { ...input, department, version: 1 }), r.res), { status: 403 });
  }
  assert.equal(d.writes.length, 0);
});

test("directors and admin can configure Sales using the same schema and API", async () => {
  for (const role of ["admin", "ban-gd"] as const) {
    const d = repository();
    const controller = new KpiController(d.repo);
    const r = response();
    await controller.list(req(role), r.res);
    assert.deepEqual(d.scopes[0], manageableKpiDepartments(role));
    for (const department of ["sale-vn", "sale-global"] as const) {
      await controller.create(req(role, { ...input, department, group: "Sale", code: "KPI_1_SALE", target: 125.5 }), r.res);
      assert.equal(r.status(), 201);
      assert.deepEqual(r.body(), { definition: { ...input, department, group: "Sale", code: "KPI_1_SALE", target: 125.5, id, version: 1 } });
      await controller.update(req(role, { ...input, department, version: 1, active: false }), r.res);
      assert.equal((r.body() as { definition: KpiDefinition }).definition.active, false);
    }
  }
});

test("KPI validation preserves unset vs zero targets, decimals and normalized codes", () => {
  assert.equal(createKpiSchema.parse({ ...input, code: " kpi_1_c_mkt " }).code, input.code);
  for (const target of [null, 0, 12.75]) assert.equal(createKpiSchema.parse({ ...input, target }).target, target);
  for (const change of [{ target: -1 }, { target: Infinity }, { target: "5" }, { group: " " }, { unit: "" }, { code: "KPI bad" }, { department: "unknown" }, { period: "bad" }, { extra: true }]) {
    assert.equal(createKpiSchema.safeParse({ ...input, ...change }).success, false, JSON.stringify(change));
  }
});

test("invalid writes do not reach persistence; duplicate codes and stale edits return 409", async () => {
  const d = repository();
  const controller = new KpiController(d.repo);
  const r = response();
  await assert.rejects(controller.create(req("admin", { ...input, target: -1 }), r.res), { status: 400 });
  await assert.rejects(controller.update(req("admin", input), r.res), { status: 400 });
  await assert.rejects(controller.list(req("admin", {}, { department: "unknown" }), r.res), { status: 400 });
  assert.equal(d.writes.length, 0);
  const duplicate = new KpiController(repository({ create: async () => { throw { code: "23505" }; } }).repo);
  await assert.rejects(duplicate.create(req("admin"), r.res), { status: 409, code: "DUPLICATE_KPI" });
  const stale = new KpiController(repository({ update: async () => null }).repo);
  await assert.rejects(stale.update(req("admin", { ...input, version: 1 }), r.res), { status: 409, code: "KPI_CONFLICT" });
  await assert.rejects(new KpiController(null).list(req("admin"), r.res), { status: 503 });
});

test("Postgres persists department KPIs, seeds, uniqueness and optimistic locking", { skip: !process.env.KPI_TEST_DATABASE_URL }, async () => {
  const url = new URL(process.env.KPI_TEST_DATABASE_URL!);
  assert.ok(["127.0.0.1", "localhost"].includes(url.hostname), "Integration test must use a local database");
  const client = new pg.Client({ connectionString: url.toString(), ssl: false });
  await client.connect();
  try {
    await client.query("begin");
    const repo = new PostgresKpiRepository({ query: client.query.bind(client) } as unknown as pg.Pool);
    const seeds = (await repo.list(["marketing"])).filter(value => ["KPI_1_C_MKT", "KPI_2_C_MKT", "KPI_1_M_MKT"].includes(value.code));
    assert.deepEqual(seeds.map(value => value.code).sort(), ["KPI_1_C_MKT", "KPI_1_M_MKT", "KPI_2_C_MKT"]);
    const code = `KPI_TEST_${Date.now()}`;
    const created = await repo.create({ ...input, code, department: "sale-vn", group: "Sale", target: 12.75 }, "test");
    assert.equal(created.target, 12.75);
    assert.equal(created.version, 1);
    const updated = await repo.update(created.id, { ...input, code, department: "sale-vn", group: "Sale", target: 0, active: false, version: 1 }, "test");
    assert.equal(updated?.target, 0);
    assert.equal(updated?.active, false);
    assert.equal(updated?.version, 2);
    assert.equal(await repo.update(created.id, { ...input, code, department: "sale-vn", version: 1 }, "test"), null);
    // A forged Marketing department cannot update an existing Sales KPI.
    assert.equal(await repo.update(created.id, { ...input, code, version: 2 }, "test"), null);
    const stored = (await repo.list(["sale-vn"])).find(value => value.id === created.id);
    assert.deepEqual(stored, updated);
    assert.equal((await repo.list(["marketing"])).some(value => value.id === created.id), false);
    await repo.create({ ...input, code, department: "sale-global", group: "Sale" }, "test");
    await assert.rejects(repo.create({ ...input, code, department: "sale-vn" }, "test"), { code: "23505" });
  } finally {
    await client.query("rollback");
    await client.end();
  }
});

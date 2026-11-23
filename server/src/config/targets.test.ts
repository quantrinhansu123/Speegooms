import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";
import type pg from "pg";
import { roleSchema, saleTargetMetrics, type Role } from "@speego/shared";
import { PostgresTargetsRepository } from "../adapters/postgres/targets.repository";
import { TargetsController } from "../controllers/targets.controller";

type Call = { sql: string; values?: unknown[] };

function fakePool(options: { members?: { id: string; name: string }[]; stored?: { user_id: string; code: string; value: number }[] } = {}) {
  const calls: Call[] = [];
  const members = options.members ?? [{ id: "u1", name: "An" }, { id: "u2", name: "Bình" }];
  const run = async (sql: string, values?: unknown[]) => {
    calls.push({ sql, values });
    if (/from public\.nguoi_dung/.test(sql)) return { rows: members };
    if (/select user_id, code/.test(sql)) return { rows: options.stored ?? [] };
    return { rows: [] };
  };
  const pool = { query: run, connect: async () => ({ query: run, release: () => undefined }) } as unknown as pg.Pool;
  return { pool, calls };
}

const req = (role: Role | undefined, init: { query?: unknown; body?: unknown } = {}) =>
  ({ user: role ? { id: "actor", role } : undefined, query: init.query ?? {}, body: init.body ?? {} }) as unknown as Request;
function response() {
  let body: unknown;
  const res = { setHeader() { return this; }, json(value: unknown) { body = value; } } as unknown as Response;
  return { res, body: () => body };
}
const month = { department: "sale-vn", period: "month", start: "2026-11-01" };
const write = (rows: unknown[], extra = {}) => ({ body: { ...month, rows, ...extra } });

test("only admin, directors and the matching lead can read or save targets", async () => {
  const expectations: Record<string, string[]> = {
    admin: ["sale-vn", "sale-global", "marketing"],
    "ban-gd": ["sale-vn", "sale-global", "marketing"],
    "sale-global-lead": ["sale-global"],
    "marketing-lead": ["marketing"],
  };
  for (const role of roleSchema.options) {
    const allowedDepartments = expectations[role] ?? [];
    for (const department of ["sale-vn", "sale-global", "marketing"]) {
      const { pool } = fakePool();
      const controller = new TargetsController(new PostgresTargetsRepository(pool));
      const query = { ...month, department };
      if (allowedDepartments.includes(department)) {
        await controller.read(req(role, { query }), response().res);
        await controller.write(req(role, { body: { ...query, rows: [] } }), response().res);
      } else {
        await assert.rejects(controller.read(req(role, { query }), response().res), { status: 403 }, `${role} read ${department}`);
        await assert.rejects(controller.write(req(role, { body: { ...query, rows: [] } }), response().res), { status: 403 }, `${role} write ${department}`);
      }
    }
  }
  const noUser = new TargetsController(new PostgresTargetsRepository(fakePool().pool));
  await assert.rejects(noUser.read(req(undefined, { query: month }), response().res), { status: 401 });
  await assert.rejects(new TargetsController(null).read(req("admin", { query: month }), response().res), { status: 503 });
});

test("bad periods and values are refused before touching the database", async () => {
  const { pool, calls } = fakePool();
  const controller = new TargetsController(new PostgresTargetsRepository(pool));
  await assert.rejects(controller.read(req("admin", { query: { ...month, start: "2026-11-09" } }), response().res), { status: 400 });
  await assert.rejects(controller.write(req("admin", write([{ userId: "u1", code: "SALE_REVENUE_VND", value: -5 }])), response().res), { status: 400 });
  await assert.rejects(controller.write(req("admin", write([], { start: "2026-11-23", period: "week" })), response().res), { status: 400 });
  assert.equal(calls.length, 0);
});

test("saving writes one transaction: upsert for numbers, delete for null, then returns the fresh grid", async () => {
  const { pool, calls } = fakePool({ stored: [{ user_id: "u1", code: "SALE_REVENUE_VND", value: 2_500_000 }] });
  const controller = new TargetsController(new PostgresTargetsRepository(pool));
  const out = response();
  await controller.write(req("admin", write([
    { userId: "u1", code: "SALE_REVENUE_VND", value: 2_500_000 },
    { userId: "u2", code: "SALE_SELF_SOURCED", value: null },
  ])), out.res);
  const statements = calls.map((call) => call.sql.trim().split(/\s+/)[0]!.toLowerCase());
  assert.equal(statements.filter((word) => word === "begin").length, 1);
  assert.equal(statements.filter((word) => word === "commit").length, 1);
  assert.equal(statements.includes("rollback"), false);
  const upsert = calls.find((call) => /insert into app\.kpi_targets/.test(call.sql))!;
  assert.deepEqual(upsert.values, ["sale-vn", "u1", "month", "2026-11-01", "SALE_REVENUE_VND", 2_500_000, "actor"]);
  assert.match(upsert.sql, /on conflict \(user_id, period, start_date, code\) do update/);
  const removal = calls.find((call) => /delete from app\.kpi_targets/.test(call.sql))!;
  assert.deepEqual(removal.values, ["u2", "month", "2026-11-01", "SALE_SELF_SOURCED"]);
  const grid = out.body() as { members: unknown[]; metrics: { code: string }[]; values: Record<string, Record<string, number>> };
  assert.deepEqual(grid.values, { u1: { SALE_REVENUE_VND: 2_500_000 } });
  assert.deepEqual(grid.metrics.map((metric) => metric.code), saleTargetMetrics.map((metric) => metric.code));
});

test("people outside the team, unknown metrics and rates above 100 are rejected without saving", async () => {
  for (const [row, message] of [
    [{ userId: "stranger", code: "SALE_REVENUE_VND", value: 1 }, /không thuộc nhóm/],
    [{ userId: "u1", code: "NOT_A_METRIC", value: 1 }, /không áp dụng/],
    [{ userId: "u1", code: "SALE_QUOTE_RATE", value: 120 }, /0–100/],
  ] as const) {
    const { pool, calls } = fakePool();
    const controller = new TargetsController(new PostgresTargetsRepository(pool));
    await assert.rejects(controller.write(req("admin", write([row])), response().res), (error: Error) => message.test(error.message));
    assert.equal(calls.some((call) => /insert into app\.kpi_targets/.test(call.sql)), false);
  }
});

test("a failure in the middle rolls the whole save back", async () => {
  const calls: string[] = [];
  const pool = {
    query: async (sql: string) => ({ rows: /nguoi_dung/.test(sql) ? [{ id: "u1", name: "An" }] : [] }),
    connect: async () => ({
      query: async (sql: string) => {
        calls.push(sql.trim().split(/\s+/)[0]!.toLowerCase());
        if (/insert into app\.kpi_targets/.test(sql)) throw new Error("boom");
        return { rows: [] };
      },
      release: () => undefined,
    }),
  } as unknown as pg.Pool;
  const controller = new TargetsController(new PostgresTargetsRepository(pool));
  await assert.rejects(controller.write(req("admin", write([{ userId: "u1", code: "SALE_REVENUE_VND", value: 1 }])), response().res), /boom/);
  assert.deepEqual(calls, ["begin", "insert", "rollback"]);
});

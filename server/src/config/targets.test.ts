import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";
import type pg from "pg";
import { roleSchema, saleTargetMetrics, type Role } from "@speego/shared";
import { PostgresTargetsRepository } from "../adapters/postgres/targets.repository";
import { TargetsController } from "../controllers/targets.controller";
import { MarketingController } from "../controllers/marketing.controller";

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

const kpiTypes = [
  { id: "956415bc-a231-4a37-8f3a-1c8e04a7e003", kind: "ads", name: "KPI_1_A_MKT - Số mess", unit: "mess", direction: "at-least", active: true },
  { id: "956415bc-a231-4a37-8f3a-1c8e04a7e004", kind: "ads", name: "KPI_2_A_MKT - CP/Mess TT", unit: "VND/mess", direction: "at-most", active: true },
  { id: "956415bc-a231-4a37-8f3a-1c8e04a7e099", kind: "ads", name: "KPI đã ngừng", unit: "x", direction: "at-least", active: false },
];

function marketingPool(extra: { results?: unknown[]; targets?: unknown[] } = {}) {
  const calls: Call[] = [];
  const query = async (sql: string, values?: unknown[]) => {
    calls.push({ sql, values });
    if (/marketing_kpi_settings/.test(sql)) return { rows: [{ types: kpiTypes }] };
    if (/from public\.nguoi_dung/.test(sql)) return { rows: [{ id: "m1", name: "Hạnh" }] };
    if (/from app\.kpi_targets/.test(sql)) return { rows: extra.targets ?? [] };
    if (/from app\.marketing_tasks/.test(sql)) return { rows: extra.results ?? [] };
    return { rows: [] };
  };
  return { pool: { query, connect: async () => ({ query, release: () => undefined }) } as unknown as pg.Pool, calls };
}

test("Marketing targets use the same KPI types as Giao việc (active only, with direction)", async () => {
  const { pool } = marketingPool();
  const grid = await new PostgresTargetsRepository(pool).grid("marketing", "month", "2026-11-01");
  assert.deepEqual(grid.metrics.map((metric) => [metric.code, metric.direction]), [
    ["956415bc-a231-4a37-8f3a-1c8e04a7e003", "at-least"],
    ["956415bc-a231-4a37-8f3a-1c8e04a7e004", "at-most"],
  ]);
  // Lưu theo mã uuid của loại KPI; mã KPI đã ngừng bị từ chối.
  const controller = new TargetsController(new PostgresTargetsRepository(pool));
  await controller.write(req("marketing-lead", { body: { department: "marketing", period: "month", start: "2026-11-01", rows: [{ userId: "m1", code: kpiTypes[0]!.id, value: 250 }] } }), response().res);
  await assert.rejects(controller.write(req("marketing-lead", { body: { department: "marketing", period: "month", start: "2026-11-01", rows: [{ userId: "m1", code: kpiTypes[2]!.id, value: 1 }] } }), response().res), { status: 400 });
});

test("Marketing target report returns targets next to accepted results for the period", async () => {
  const { pool, calls } = marketingPool({
    targets: [{ user_id: "m1", code: kpiTypes[0]!.id, value: 250 }],
    results: [{ user_id: "m1", code: kpiTypes[0]!.id, actual: 180, tasks: 3 }],
  });
  const controller = new MarketingController(pool);
  const out = response();
  await controller.targetReport(req("marketing-lead", { query: { period: "week", start: "2026-11-22" } }), out.res);
  const body = out.body() as { start: string; end: string; targets: Record<string, Record<string, number>>; results: Record<string, Record<string, { actual: number; tasks: number }>>; metrics: { code: string; direction: string }[] };
  assert.equal(body.start, "2026-11-22");
  assert.equal(body.end, "2026-11-29");
  assert.deepEqual(body.targets, { m1: { [kpiTypes[0]!.id]: 250 } });
  assert.deepEqual(body.results, { m1: { [kpiTypes[0]!.id]: { actual: 180, tasks: 3 } } });
  assert.equal(body.metrics.find((metric) => metric.code === kpiTypes[1]!.id)?.direction, "at-most");
  // Chỉ lấy việc đã nghiệm thu Đạt, không Hủy, theo ngày hoàn thành/deadline trong [start, end).
  const resultSql = calls.find((call) => /from app\.marketing_tasks/.test(call.sql))!;
  assert.match(resultSql.sql, /acceptance' = 'Đạt'/);
  assert.match(resultSql.sql, /status' <> 'Hủy'/);
  assert.deepEqual(resultSql.values, ["2026-11-22", "2026-11-29"]);
  assert.deepEqual(calls.find((call) => /from app\.kpi_targets/.test(call.sql))!.values, ["week", "2026-11-22"]);
});

test("Marketing target report is limited to the Marketing team and valid periods", async () => {
  for (const role of roleSchema.options) {
    const controller = new MarketingController(marketingPool().pool);
    const allowed = ["marketing", "marketing-content", "marketing-lead", "admin", "ban-gd"].includes(role);
    const call = controller.targetReport(req(role, { query: { period: "month", start: "2026-11-01" } }), response().res);
    if (allowed) await call; else await assert.rejects(call, { status: 403 }, role);
  }
  const controller = new MarketingController(marketingPool().pool);
  await assert.rejects(controller.targetReport(req("admin", { query: { period: "week", start: "2026-11-23" } }), response().res), { status: 400 });
  await assert.rejects(controller.targetReport(req("admin", { query: { period: "year", start: "2026-11-01" } }), response().res), { status: 400 });
  await assert.rejects(controller.targetReport(req(undefined, { query: { period: "month", start: "2026-11-01" } }), response().res), { status: 403 });
});

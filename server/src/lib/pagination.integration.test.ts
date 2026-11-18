import assert from "node:assert/strict";
import test from "node:test";
import { config } from "dotenv";
import { dataLanhListSchema, proposalListSchema } from "@speego/shared";
import type pg from "pg";
import type { Request, Response } from "express";
import { MarketingController } from "../controllers/marketing.controller";
import { loadEnv } from "../config/env";
import { getPostgresPool, closePostgresPool } from "../adapters/postgres/pool";
import { PostgresCrmRepository } from "../adapters/postgres/crm.repository";
import { PostgresDataLanhRepository } from "../adapters/postgres/data-lanh.repository";
import { PostgresDeXuatRepository } from "../adapters/postgres/de-xuat.repository";
import { PostgresKeToanRepository } from "../adapters/postgres/ke-toan.repository";
import { queryPage } from "./pagination";
import { QUOTE_REQUESTED_AT_SQL, LOGISTICS_REQUESTED_AT_SQL, PRESERVE_REQUEST_TIME_SQL } from "../adapters/postgres/logistics-handoff";
import { DateRangeCriterion } from "../search/date-range-criterion";
import { SearchBuilder } from "../search/search-builder";
import { sql } from "../search/sql-expression";

test("pagination executes read-only SQL, keeps totals and reaches records beyond the first page", { skip: process.env.SPEEGO_DB_CHECK !== "1" }, async () => {
  config({ path: new URL("../../.env", import.meta.url), quiet: true });
  const pool = getPostgresPool(loadEnv());
  const client = await pool.connect();
  let lastQuery: Promise<unknown> = Promise.resolve();
  const db = { query: (sql: string, values: readonly unknown[] = []) => {
    const result = lastQuery.then(() => client.query(sql, [...values]));
    lastQuery = result.catch(() => undefined);
    return result;
  } };
  const repoPool = db as unknown as pg.Pool;
  try {
    await client.query("begin read only");
    // Older drafts requested later belong above newer drafts, across both desks.
    const requests = `select q.id, q.tao_luc as created_at,
      case when q.shared then ${LOGISTICS_REQUESTED_AT_SQL} else ${QUOTE_REQUESTED_AT_SQL} end as requested_at
      from (values
        ('sale', '2026-11-10T08:00:00Z'::timestamptz, '{"handoffAt":"2026-11-13T00:30:00+07:00"}'::jsonb, null::jsonb, null::jsonb, false),
        ('newer-draft', '2026-11-12T08:00:00Z'::timestamptz, '{"handoffAt":"2026-11-12T09:00:00Z"}'::jsonb, null::jsonb, null::jsonb, false),
        ('sourcing', '2026-11-08T08:00:00Z'::timestamptz, '{}'::jsonb, '{"handoffAt":"2026-11-14T01:00:00Z"}'::jsonb, null::jsonb, true),
        ('legacy-sent', '2026-11-07T08:00:00Z'::timestamptz, '{}'::jsonb, '{}'::jsonb, '{"sentAt":"2026-11-11T01:00:00Z"}'::jsonb, true),
        ('legacy', '2026-11-06T08:00:00Z'::timestamptz, '{}'::jsonb, null::jsonb, null::jsonb, false)
      ) q(id, tao_luc, ghi_chu, bao_gia_logistics, ban_da_gui, shared)`;
    const order = { orderBy: "requested_at desc, id desc" };
    const requestFirst = await queryPage<{ id: string; created_at: Date; requested_at: Date }>(db, requests, [], { page: 1, pageSize: 2 }, order);
    const requestSecond = await queryPage<{ id: string }>(db, requests, [], { page: 2, pageSize: 2 }, order);
    assert.deepEqual(requestFirst.rows.map(row => row.id), ["sourcing", "sale"]);
    assert.equal(requestFirst.rows[1].created_at.toISOString(), "2026-11-10T08:00:00.000Z");
    assert.equal(requestFirst.rows[1].requested_at.toISOString(), "2026-11-12T17:30:00.000Z");
    assert.deepEqual(requestSecond.rows.map(row => row.id), ["newer-draft", "legacy-sent"]);
    const range = new SearchBuilder().add(new DateRangeCriterion(sql("requested_at"), "2026-11-13", "2026-11-13", "timestamp")).build();
    const daily = await queryPage<{ id: string }>(db, requests, range.values, { page: 1, pageSize: 20 }, {
      ...order, where: `true ${range.sql}`,
    });
    assert.deepEqual(daily.rows.map(row => row.id), ["sale"]);
    assert.equal(daily.pagination.total, 1);
    const preserved = await db.query(`select ${PRESERVE_REQUEST_TIME_SQL.replace("$7", "$1")} as notes
      from (select '{"handoffAt":"2026-11-13T03:00:00Z"}'::jsonb as ghi_chu) stored`, ['{"weightNote":"Edited"}']);
    assert.deepEqual(preserved.rows[0].notes, { handoffAt: "2026-11-13T03:00:00Z", weightNote: "Edited" });
    const source = "select lpad(n::text, 3, '0') as id, n as value from generate_series(1, 45) n";
    const page = { page: 1, pageSize: 20 };
    const first = await queryPage<{ id: string; value: number }>(db, source, [], page, { orderBy: "id" });
    const second = await queryPage<{ id: string; value: number }>(db, source, [], { ...page, page: 2 }, { orderBy: "id" });
    assert.equal(first.rows.length, 20);
    assert.equal(second.rows.length, 20);
    assert.equal(second.rows[0]?.value, 21);
    assert.equal(first.pagination.total, 45);
    assert.equal(first.pagination.pages, 3);
    const last = await queryPage(db, source, [], { ...page, page: 99 }, { orderBy: "id" });
    assert.equal(last.pagination.page, 3);
    assert.equal(last.rows.length, 5);
    const focused = await queryPage(db, source, [], { ...page, focusId: "041" }, { orderBy: "id" });
    assert.equal(focused.pagination.page, 3);
    const empty = await queryPage(db, source, [100], page, { orderBy: "id", where: "value > $1", summary: "jsonb_build_object('sum', sum(value))" });
    assert.equal(empty.pagination.total, 0);
    assert.equal(empty.rows.length, 0);
    assert.equal(empty.pagination.summary.sum, 1035);

    const crm = new PostgresCrmRepository(repoPool);
    const accounting = new PostgresKeToanRepository(repoPool);
    const proposals = new PostgresDeXuatRepository(repoPool);
    const common = { q: "", from: "", to: "" };
    const quote = { ...common, quoteStatus: "", contractStatus: "", customerKind: "" };
    for (const lane of ["vn", "global"] as const) {
      for (const p of [1, 2]) {
        const request = { ...page, page: p };
        const results = [
          await crm.pageMessages(lane, { ...common, status: "", classification: "", demand: "", customerType: "", market: "" }, request),
          await crm.pagePotentials(lane, { ...common, source: "", potential: "", customerKind: "", customerType: "" }, request),
          await crm.pageQuotes([lane], "sourcing", quote, request),
          await crm.pageQuotes([lane], "logistics", quote, request),
          await crm.pageRfqQuotes(lane, quote, "", request),
          await crm.pageRfqQuotes(lane, quote, "logistics", request),
          await crm.pageContracts(lane, false, "sale", { ...common, opsStatus: "", accountingStatus: "" }, request),
        ];
        for (const result of results) assert.ok(result.rows.length <= 20);
      }
    }
    assert.ok((await crm.pageQuotes(["vn", "global"], "logistics", quote, page)).rows.length <= 20);
    const cold = await new PostgresDataLanhRepository(repoPool).listPage(null, dataLanhListSchema.parse({ page: 2 }));
    assert.ok(cold.rows.length <= 20);
    await proposals.pageList(null, "pagination-check", proposalListSchema.parse({ tab: "admin" }), page);
    await proposals.stats(new Date("2020-01-01"), new Date("2030-01-01"), "", page);
    await proposals.usage("pagination-check");
    await accounting.pagePayments({ ...common, status: "", payeeKind: "", purpose: "" }, page);
    await accounting.pagePayroll({ ...common, department: "" }, page);
    await accounting.pageExpenses({ ...common, department: "", status: "" }, page);
    await accounting.pageLedger({ ...common, kind: "", category: "", dateField: "", counterparty: "" }, page);
    await accounting.pageStatements(page);
    await accounting.pageStatements(page, "00000000-0000-4000-8000-000000000000");
    const marketingReady = (await client.query("select to_regclass('app.marketing_tasks') as name")).rows[0]?.name;
    {
      // Validate SQL even when the separate Marketing migration has not been deployed.
      const marketingPool = marketingReady ? repoPool : { query: (sql: string, values: readonly unknown[] = []) => db.query(sql
        .replaceAll("app.marketing_tasks", "(select null::uuid as id, '{}'::jsonb as data, 0 as version, now() as updated_at where false) marketing_tasks")
        .replaceAll("app.marketing_reports", "(select ''::text as platform, ''::text as channel, ''::text as post_id, '{}'::jsonb as data, now() as updated_at where false) marketing_reports"), values) } as unknown as pg.Pool;
      const marketing = new MarketingController(marketingPool);
      for (const view of ["tasks", "reports", "kpi"] as const) {
        let result: { pagination: { pageSize: number }; tasks: unknown[]; reports: unknown[]; groups: unknown[] } | undefined;
        await marketing.list({ user: { role: "admin" }, query: { view } } as unknown as Request, {
          json(body: typeof result) { result = body; },
        } as unknown as Response);
        assert.equal(result?.pagination.pageSize, 20);
        assert.ok((result?.[view === "kpi" ? "groups" : view]?.length ?? 0) <= 20);
      }
    }
  } finally {
    await client.query("rollback").catch(() => undefined);
    client.release();
    await closePostgresPool();
  }
});

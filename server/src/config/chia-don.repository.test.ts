import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import pg from "pg";
import type { AssignmentDesk, CrmLane } from "@speego/shared";
import { PostgresAssignmentRepository } from "../adapters/postgres/chia-don.repository";

// Use a dedicated disposable database, never the application's DATABASE_URL.
test("consecutive quote assignment against PostgreSQL", { skip: !process.env.SPEEGO_ASSIGNMENT_TEST_URL }, async (t) => {
  const target = new URL(process.env.SPEEGO_ASSIGNMENT_TEST_URL!);
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(target.hostname));
  assert.equal(target.pathname, "/speego_assignment_test", "Use the dedicated local speego_assignment_test database");
  const pool = new pg.Pool({ connectionString: process.env.SPEEGO_ASSIGNMENT_TEST_URL });
  const repo = new PostgresAssignmentRepository(pool);
  try {
    await pool.query(`
      create schema if not exists crm;
      create schema if not exists app;
      create table if not exists public.nguoi_dung (ma_nguoi_dung text primary key, ho_ten text);
      create table if not exists app.de_xuat (nguoi_tao_id text, loai text, trang_thai text, chi_tiet jsonb);
    `);
    await pool.query(await readFile(new URL("../../db/migrations/048_chia_don.sql", import.meta.url), "utf8"));
    for (const suffix of ["viet_nam", "global"]) {
      await pool.query(`
        create table if not exists crm.tin_nhan_${suffix} (id uuid primary key, thong_tin_don_hang jsonb);
        create table if not exists crm.khach_hang_tiem_nang_${suffix} (
          id uuid primary key, ma_tin_nhan uuid, so_dien_thoai_chuan text, thu_dien_tu_chuan text, xoa_luc timestamptz
        );
      `);
      for (const desk of ["sourcing", "logistics"]) await pool.query(`
        create table if not exists crm.bao_gia_${desk}_${suffix} (
          id uuid primary key, ma_khach_hang_tiem_nang uuid, chi_tiet_don_hang jsonb
        );
      `);
    }
    await pool.query(`insert into public.nguoi_dung values ('a', 'A'), ('b', 'B'), ('c', 'C') on conflict do nothing`);
    const reset = async () => {
      await pool.query("delete from crm.chia_don; delete from crm.chia_don_nguoi_nhan; delete from app.de_xuat");
      for (const desk of ["sourcing", "logistics"]) await pool.query(
        "insert into crm.chia_don_nguoi_nhan (ban, nguoi_dung_id, thu_tu) values ($1, 'a', 1), ($1, 'b', 2), ($1, 'c', 3)", [desk],
      );
    };
    const quote = async (name: string | null, options: {
      phone?: string | null; email?: string | null; lane?: CrmLane; desk?: AssignmentDesk;
      draft?: boolean; selectedName?: string; deleted?: boolean;
    } = {}) => {
      const id = randomUUID(), customerId = randomUUID(), messageId = randomUUID();
      const suffix = options.lane === "global" ? "global" : "viet_nam";
      const orders = name === null ? [] : [{ name, selected: !options.selectedName },
        ...(options.selectedName ? [{ name: options.selectedName, selected: true }] : [])];
      await pool.query(`insert into crm.tin_nhan_${suffix} values ($1, $2::jsonb)`,
        [messageId, options.draft ? JSON.stringify({ name }) : null]);
      await pool.query(`insert into crm.khach_hang_tiem_nang_${suffix} values ($1, $2, $3, $4, $5)`,
        [customerId, messageId, options.phone === undefined ? "0900000000" : options.phone, options.email ?? null, options.deleted ? new Date() : null]);
      await pool.query(`insert into crm.bao_gia_${options.desk ?? "logistics"}_${suffix} values ($1, $2, $3::jsonb)`,
        [id, customerId, JSON.stringify(options.draft ? [] : orders)]);
      return id;
    };
    const assigned = async (id: string, lane: CrmLane = "vn", desk: AssignmentDesk = "logistics") => (await repo.assign(lane, desk, id))?.id;

    await t.test("AIR/SEA pair stays with A, the next different order goes to B, on both lanes and desks", async () => {
      for (const lane of ["vn", "global"] as const) for (const desk of ["sourcing", "logistics"] as const) {
        await reset();
        assert.equal(await assigned(await quote("Lô Quần Áo", { lane, desk }), lane, desk), "a");
        assert.equal(await assigned(await quote("  lô   quần áo \n", { lane, desk }), lane, desk), "a");
        assert.equal(await assigned(await quote("Lô linh kiện", { lane, desk }), lane, desk), "b");
      }
    });
    await t.test("different customer, different lane, missing/blank name and deleted lead do not group", async () => {
      for (const options of [{ phone: "0900000001" }, { lane: "global" as const }, { deleted: true }]) {
        await reset();
        await assigned(await quote("Lô áo"));
        assert.equal(await assigned(await quote("Lô áo", options), options.lane), "b");
      }
      for (const name of [null, "", "   "]) {
        await reset();
        await assigned(await quote(name));
        assert.equal(await assigned(await quote(name)), "b");
      }
      await reset();
      await assigned(await quote("Lô áo", { phone: null }));
      assert.equal(await assigned(await quote("Lô áo", { phone: null })), "b");
    });
    await t.test("only the immediately preceding assignment is considered; desks rotate independently", async () => {
      await reset();
      await assigned(await quote("Lô áo"));
      await assigned(await quote("Đơn xen giữa"));
      assert.equal(await assigned(await quote("Lô áo")), "c");
      assert.equal(await assigned(await quote("Lô áo", { desk: "sourcing" }), "vn", "sourcing"), "a");
    });
    await t.test("draft Mess name and selected quote order are used, not an unrelated alternative", async () => {
      await reset();
      await assigned(await quote("Lô áo", { draft: true }));
      assert.equal(await assigned(await quote("Lô áo", { draft: true })), "a");
      assert.equal(await assigned(await quote("Khác", { selectedName: "Lô áo" })), "a");
      assert.equal(await assigned(await quote("Lô áo", { selectedName: "Đơn mới" })), "b");
    });
    await t.test("Logistics can group a combined Sourcing handoff and a pure Logistics quote", async () => {
      await reset();
      await assigned(await quote("Lô áo", { desk: "sourcing" }));
      assert.equal(await assigned(await quote("Lô áo")), "a");
    });
    await t.test("email identifies a customer without phone; conflicting phones do not group by email", async () => {
      await reset();
      await assigned(await quote("Lô áo", { phone: null, email: "test@example.com" }));
      assert.equal(await assigned(await quote("Lô áo", { phone: null, email: "test@example.com" })), "a");
      assert.equal(await assigned(await quote("Lô áo", { phone: "0900000001", email: "test@example.com" })), "b");
    });
    await t.test("manual off and full-day approved leave skip the old recipient; revisions keep them", async () => {
      for (const off of ["manual", "leave"]) {
        await reset();
        const first = await quote("Lô áo");
        await assigned(first);
        if (off === "manual") await repo.setOff("logistics", "a", true);
        else await pool.query(`insert into app.de_xuat values ('a', 'nghi-phep', 'da-duyet',
          jsonb_build_object('duration', 'full', 'startDate', current_date::text, 'endDate', current_date::text))`);
        assert.equal(await assigned(await quote("Lô áo")), "b");
        const before = await pool.query("select * from crm.chia_don where bao_gia_id = $1", [first]);
        assert.equal(await assigned(first), "a");
        assert.deepEqual((await pool.query("select * from crm.chia_don where bao_gia_id = $1", [first])).rows, before.rows);
      }
      await pool.query("update crm.chia_don_nguoi_nhan set off_thu_cong = true");
      assert.equal(await assigned(await quote("Lô áo")), undefined);
    });
    await t.test("concurrent duplicate requests create one assignment and advance the rotation once", async () => {
      await reset();
      const first = await quote("Lô áo"), second = await quote("Lô áo"), third = await quote("Khác");
      assert.deepEqual(await Promise.all([assigned(first), assigned(first)]), ["a", "a"]);
      assert.deepEqual(await Promise.all([assigned(second), assigned(second)]), ["a", "a"]);
      assert.equal(await assigned(third), "b");
      assert.equal((await pool.query("select count(*)::int as n from crm.chia_don")).rows[0].n, 3);
      await reset();
      const pair = await Promise.all([quote("Lô áo"), quote("Lô áo")]);
      assert.deepEqual(await Promise.all(pair.map((id) => assigned(id))), ["a", "a"]);
      assert.equal(await assigned(await quote("Khác")), "b");
    });
  } finally {
    await pool.end();
  }
});

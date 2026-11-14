import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import type { AddressInfo } from "node:net";
import express, { type Request } from "express";
import pg from "pg";
import { facebookStatuses, telesaleStatuses } from "@speego/shared";
import { PostgresDataLanhRepository } from "../adapters/postgres/data-lanh.repository";
import { DataLanhController } from "../controllers/data-lanh.controller";
import { dataLanhRoutes } from "../routes/data-lanh.routes";
import { errorHandler } from "../middlewares/error-handler";
import type { AppContainer } from "../container";

test("recipient endpoints are admin-only and validate account IDs", async () => {
  const calls: unknown[][] = [];
  const repo = {
    listRecipients: async () => [],
    changeRecipient: async (...args: unknown[]) => { calls.push(args); return { assigned: 4, interns: 2 }; },
  };
  const app = express();
  app.use(express.json());
  app.use("/api/data-lanh", dataLanhRoutes({
    authenticate: (req, _res, next) => {
      req.user = { id: "admin", role: req.headers["x-role"] } as NonNullable<Request["user"]>;
      next();
    },
    dataLanhController: new DataLanhController(repo as unknown as PostgresDataLanhRepository),
  } as AppContainer));
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/data-lanh/recipients`;
  try {
    for (const role of ["ban-gd", "sale-vn", "sale-global", "sale-intern"]) {
      for (const method of ["GET", "POST", "DELETE"]) {
        assert.equal((await fetch(url, { method, headers: { "x-role": role } })).status, 403);
      }
    }
    const headers = { "x-role": "admin", "content-type": "application/json" };
    assert.equal((await fetch(url, { headers })).status, 200);
    for (const userId of [undefined, "", "x".repeat(65), 42]) {
      assert.equal((await fetch(url, { method: "POST", headers, body: JSON.stringify({ userId }) })).status, 422);
    }
    for (const method of ["POST", "DELETE"]) {
      assert.equal((await fetch(url, { method, headers, body: JSON.stringify({ userId: "sale-b" }) })).status, 200);
    }
    assert.deepEqual(calls, [["sale-b", "add"], ["sale-b", "remove"]]);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  }
});

test("Postgres recipient changes redistribute only untouched customers atomically", { skip: !process.env.DATA_LANH_POOL_TEST_URL }, async t => {
  const url = new URL(process.env.DATA_LANH_POOL_TEST_URL!);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname));
  assert.equal(url.pathname, "/data_lanh_pool_test");
  const pool = new pg.Pool({ connectionString: url.toString(), application_name: "recipients-pool-test" });
  const repo = new PostgresDataLanhRepository(pool);
  try {
    await pool.query(`create schema crm; create table public.nguoi_dung (ma_nguoi_dung text primary key, ho_ten text, thu_dien_tu text, vai_tro text)`);
    for (const file of ["044_data_lanh.sql", "045_data_lanh_ban_giao_sale.sql", "046_data_lanh_nguoi_nhan.sql"]) {
      await pool.query(await readFile(new URL(`../../db/migrations/${file}`, import.meta.url), "utf8"));
    }
    await pool.query(`insert into public.nguoi_dung values
      ('sale-a', 'Sale A', 'a@test', 'sale-vn'), ('sale-b', 'Sale B', 'b@test', 'sale-global'),
      ('intern', 'Intern', 'i@test', 'sale-intern'), ('admin', 'Admin', 'admin@test', 'admin')`);
    await pool.query(`insert into crm.data_lanh_nguoi_nhan values ('sale-a', 1)`);
    const reset = async () => {
      await pool.query(`truncate crm.data_lanh; delete from crm.data_lanh_nguoi_nhan; insert into crm.data_lanh_nguoi_nhan values ('sale-a', 1)`);
      await pool.query(`insert into crm.data_lanh (stt, intern_id, ghi_chu) select n, 'sale-a', 'keep note' from generate_series(1, 7) n`);
      await pool.query(`update crm.data_lanh set trang_thai_facebook = $1, trang_thai_telesale = $2 where stt = 2`, [facebookStatuses[0], telesaleStatuses[0]]);
      await pool.query(`update crm.data_lanh set trang_thai_facebook = $1 where stt = 5`, [facebookStatuses[1]]);
      await pool.query(`update crm.data_lanh set trang_thai_telesale = $1 where stt = 6`, [telesaleStatuses[4]]);
      await pool.query(`update crm.data_lanh set sale_care_id = 'sale-b', ban_giao_luc = now() where stt = 7`);
    };
    const owners = async () => (await pool.query(`select stt, intern_id, ghi_chu, sale_care_id from crm.data_lanh order by stt`)).rows;

    await t.test("adding and removing balance the unworked subset and keep worked/handover records", async () => {
      await reset();
      assert.deepEqual(await repo.changeRecipient("sale-b", "add"), { assigned: 4, interns: 2 });
      assert.deepEqual((await owners()).map(r => r.intern_id), ["sale-a", "sale-b", "sale-a", "sale-b", "sale-a", "sale-a", "sale-a"]);
      assert.ok((await owners()).every(r => r.ghi_chu === "keep note"));
      assert.equal((await repo.listRecipients())[1].email, "b@test");
      await repo.changeRecipient("sale-a", "remove");
      assert.deepEqual((await owners()).map(r => r.intern_id), ["sale-b", "sale-b", "sale-b", "sale-b", "sale-a", "sale-a", "sale-a"]);
      assert.equal((await repo.list("sale-a", null)).length, 3);
      assert.equal((await repo.list("sale-b", null)).length, 5);
      const reassigned = (await repo.list("sale-b", null)).find(r => r.stt === 1)!;
      assert.equal(await repo.handover(reassigned.id, "sale-b", "sale-a", "sale-a"), null);
      assert.equal(await repo.update(reassigned.id, { facebookStatus: facebookStatuses[1] }, "sale-a"), null);
      await assert.rejects(repo.changeRecipient("sale-b", "remove"), { status: 409 });
      await assert.rejects(repo.changeRecipient("sale-b", "add"), { status: 409 });
      await assert.rejects(repo.changeRecipient("missing", "remove"), { status: 404 });
      await assert.rejects(repo.changeRecipient("admin", "add"), { status: 422 });
      await assert.rejects(repo.changeRecipient("missing", "add"), { status: 422 });
    });

    await t.test("membership can change when no customer is eligible", async () => {
      await reset();
      await pool.query(`update crm.data_lanh set trang_thai_facebook = $1`, [facebookStatuses[2]]);
      assert.deepEqual(await repo.changeRecipient("sale-b", "add"), { assigned: 0, interns: 2 });
      assert.deepEqual(await repo.changeRecipient("sale-a", "remove"), { assigned: 0, interns: 1 });
      assert.ok((await owners()).every(r => r.intern_id === "sale-a"));
    });

    await t.test("a failed reassignment rolls back membership as well as customer ownership", async () => {
      await reset();
      await pool.query(`create function crm.reject_assignment() returns trigger language plpgsql as $$ begin raise exception 'simulated assignment failure'; end $$;
        create trigger reject_assignment before update on crm.data_lanh for each row execute function crm.reject_assignment()`);
      try {
        await assert.rejects(repo.changeRecipient("sale-b", "add"), /simulated assignment failure/);
        assert.deepEqual((await repo.listRecipients()).map(r => r.id), ["sale-a"]);
        assert.ok((await owners()).every(r => r.intern_id === "sale-a"));
      } finally { await pool.query(`drop trigger reject_assignment on crm.data_lanh; drop function crm.reject_assignment()`); }
    });

    await t.test("concurrent additions serialize without duplicate recipients", async () => {
      await reset();
      await Promise.all([repo.changeRecipient("sale-b", "add"), repo.changeRecipient("intern", "add")]);
      assert.equal((await repo.listRecipients()).length, 3);
      const counts = (await pool.query(`select count(*)::int as n from crm.data_lanh where stt <= 4 group by intern_id`)).rows.map(r => r.n);
      assert.equal(Math.max(...counts) - Math.min(...counts), 1);
    });

    await t.test("a status update committed while redistribution waits is preserved", async () => {
      await reset();
      const blocker = await pool.connect();
      let pending: ReturnType<typeof repo.changeRecipient> | undefined;
      try {
        await blocker.query("begin");
        await blocker.query(`update crm.data_lanh set trang_thai_facebook = $1 where stt = 2`, [facebookStatuses[3]]);
        pending = repo.changeRecipient("sale-b", "add");
        const deadline = Date.now() + 5000;
        while (true) {
          const waiting = await pool.query(`select 1 from pg_stat_activity where application_name = 'recipients-pool-test' and wait_event_type = 'Lock' and query like '%order by stt for update%'`);
          if (waiting.rowCount) break;
          assert.ok(Date.now() < deadline, "redistribution should wait on the customer's row lock");
          await setTimeout(10);
        }
        await blocker.query("commit");
        assert.equal((await pending).assigned, 3);
        assert.equal((await owners())[1].intern_id, "sale-a");
        const row = (await repo.list("sale-a", null)).find(r => r.stt === 2)!;
        await repo.handover(row.id, "sale-b", "sale-a", "sale-a");
        await assert.rejects(repo.handover(row.id, "sale-b", "sale-a", "sale-a"), { status: 409 });
        await repo.changeRecipient("intern", "add");
        assert.equal((await owners())[1].sale_care_id, "sale-b");
      } finally {
        await blocker.query("rollback");
        blocker.release();
        await pending?.catch(() => undefined);
      }
    });
  } finally { await pool.end(); }
});

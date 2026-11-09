import assert from "node:assert/strict";
import { test } from "node:test";
import type pg from "pg";
import { facebookStatuses, telesaleStatuses } from "@speego/shared";
import { PostgresDataLanhRepository } from "../adapters/postgres/data-lanh.repository";

const id = "00000000-0000-4000-8000-000000000001";
function fixture(facebook: string | null, telesale: string | null, accessible = true, failUpdate = false) {
  const original = { id, stt: 1, intern_id: "intern-1", sale_care_id: "sale-1", facebook_status: facebook, telesale_status: telesale, assigned_at: null };
  let saved = { ...original };
  let pending = { ...original };
  const calls: string[] = [];
  let released = false;
  const client = {
    async query(sql: string, params: unknown[] = []) {
      calls.push(sql);
      if (sql === "begin") pending = { ...saved };
      if (sql === "commit") saved = { ...pending };
      if (sql.includes("for update of d")) return { rows: accessible ? [{ ...pending }] : [], rowCount: accessible ? 1 : 0 };
      if (sql.startsWith("update crm.data_lanh")) {
        if (failUpdate) throw new Error("simulated database failure");
        for (const [, column, parameter] of sql.matchAll(/(trang_thai_facebook|trang_thai_telesale) = \$(\d+)/g)) {
          const key = column === "trang_thai_facebook" ? "facebook_status" : "telesale_status";
          pending[key] = params[Number(parameter) - 1] as string | null;
        }
      }
      return { rows: [{ ...pending }], rowCount: 1 };
    },
    release() { released = true; },
  };
  const repo = new PostgresDataLanhRepository({ connect: async () => client } as unknown as pg.Pool);
  return { repo, calls, saved: () => saved, released: () => released };
}

test("Facebook transfer rejects a missing, zero or cleared call result without saving", async () => {
  for (const telesaleStatus of [undefined, null, telesaleStatuses[0]] as const) {
    const f = fixture(facebookStatuses[3], telesaleStatuses[0]);
    await assert.rejects(f.repo.update(id, { facebookStatus: facebookStatuses[6], telesaleStatus }, "intern-1"), { status: 422 });
    assert.equal(f.saved().facebook_status, facebookStatuses[3]);
    assert.ok(!f.calls.some(sql => sql.startsWith("update ")));
    assert.equal(f.calls.at(-1), "rollback");
    assert.equal(f.released(), true);
  }
});

test("transfer saves both statuses together and keeps the same customer and intern", async () => {
  const f = fixture(facebookStatuses[3], null);
  const row = await f.repo.update(id, { facebookStatus: facebookStatuses[6], telesaleStatus: telesaleStatuses[4] }, "intern-1");
  assert.equal(row?.facebookStatus, facebookStatuses[6]);
  assert.equal(row?.telesaleStatus, telesaleStatuses[4]);
  assert.equal(row?.id, id);
  assert.equal(row?.internId, "intern-1");
  assert.equal(f.calls.filter(sql => sql.startsWith("update ")).length, 1);
  assert.equal(f.calls.at(-1), "commit");
});

test("transfer preserves the latest call result instead of a stale dialog selection", async () => {
  const f = fixture(facebookStatuses[5], telesaleStatuses[8]);
  await f.repo.update(id, { facebookStatus: facebookStatuses[6], telesaleStatus: telesaleStatuses[1] }, "intern-1");
  assert.equal(f.saved().telesale_status, telesaleStatuses[8]);
});

test("transferred customers cannot be cleared or reset to Telesale zero", async () => {
  for (const telesaleStatus of [null, telesaleStatuses[0]] as const) {
    const f = fixture(facebookStatuses[6], telesaleStatuses[4]);
    await assert.rejects(f.repo.update(id, { telesaleStatus }, "intern-1"), { status: 422 });
    assert.equal(f.saved().telesale_status, telesaleStatuses[4]);
  }
});

test("a legacy incomplete transfer can receive a real call result", async () => {
  const f = fixture(facebookStatuses[6], telesaleStatuses[0]);
  const row = await f.repo.update(id, { telesaleStatus: telesaleStatuses[1] }, "intern-1");
  assert.equal(row?.facebookStatus, facebookStatuses[6]);
  assert.equal(row?.telesaleStatus, telesaleStatuses[1]);
});

test("a Sale assignee retains update scope after the transfer merge", async () => {
  const f = fixture(facebookStatuses[3], telesaleStatuses[1]);
  const row = await f.repo.update(id, { facebookStatus: facebookStatuses[6] }, "sale-1");
  assert.equal(row?.saleCareId, "sale-1");
  assert.equal(row?.internId, "intern-1");
  assert.match(f.calls.find(sql => sql.includes("for update of d"))!, /or d\.sale_care_id = \$2/);
  assert.match(f.calls.find(sql => sql.startsWith("update "))!, /or sale_care_id = \$2/);
});

test("scope denies an inaccessible row and a failed write rolls back", async () => {
  const denied = fixture(facebookStatuses[3], null, false);
  assert.equal(await denied.repo.update(id, { facebookStatus: facebookStatuses[6], telesaleStatus: telesaleStatuses[1] }, "other-intern"), null);
  assert.ok(!denied.calls.some(sql => sql.startsWith("update ")));
  const failed = fixture(facebookStatuses[3], null, true, true);
  await assert.rejects(failed.repo.update(id, { facebookStatus: facebookStatuses[6], telesaleStatus: telesaleStatuses[1] }, "intern-1"), /simulated database failure/);
  assert.equal(failed.calls.at(-1), "rollback");
  assert.equal(failed.saved().facebook_status, facebookStatuses[3]);
});

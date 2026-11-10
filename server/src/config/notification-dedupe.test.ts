import assert from "node:assert/strict";
import { test } from "node:test";
import type pg from "pg";
import { PostgresNotificationRepository } from "../adapters/postgres/notification.repository";

const draft = { type: "quote.request", title: "t", body: "b", href: "/x", refType: "quote", refId: "q1", skipIfUnread: true };

/** Pool giả: câu select trả về những người còn thông báo chưa đọc; câu insert ghi lại danh sách người nhận. */
function fakePool(unread: string[]) {
  const inserted: string[] = [];
  const pool = {
    query: async (sql: string, params: unknown[]) => {
      if (/^\s*select/i.test(sql)) return { rows: unread.map((id) => ({ id })) };
      for (let i = 0; i < params.length; i += 10) inserted.push(String(params[i]));
      return { rows: inserted.map((id) => ({ id })) };
    },
  } as unknown as pg.Pool;
  return { pool, inserted };
}

test("không báo trùng cho người còn thông báo chưa đọc của cùng báo giá", async () => {
  const { pool, inserted } = fakePool(["a"]);
  assert.equal(await new PostgresNotificationRepository(pool).createMany(["a", "b"], draft), 1);
  assert.deepEqual(inserted, ["b"]);
});

test("mọi người đã có thông báo chưa đọc thì không chèn gì", async () => {
  const { pool, inserted } = fakePool(["a", "b"]);
  assert.equal(await new PostgresNotificationRepository(pool).createMany(["a", "b"], draft), 0);
  assert.deepEqual(inserted, []);
});

test("không bật skipIfUnread thì vẫn gửi cho tất cả", async () => {
  const { pool, inserted } = fakePool(["a"]);
  await new PostgresNotificationRepository(pool).createMany(["a", "b"], { ...draft, skipIfUnread: false });
  assert.deepEqual(inserted, ["a", "b"]);
});

test("phiếu gộp cùng mã vẫn báo riêng cho hai bàn", async () => {
  const unread = new Set<string>();
  const pool = {
    query: async (sql: string, params: unknown[]) => {
      if (/^\s*select/i.test(sql)) {
        assert.match(sql, /duong_dan = \$5/);
        return { rows: unread.has(String(params[4])) ? [{ id: "worker" }] : [] };
      }
      unread.add(String(params[5]));
      return { rows: [{ id: "notification" }] };
    },
  } as unknown as pg.Pool;
  const repository = new PostgresNotificationRepository(pool);
  const sourcing = { ...draft, href: "/van-hanh/sourcing-bao-gia?id=q1&lane=vn" };
  const logistics = { ...draft, href: "/van-hanh/logistics-bao-gia?id=q1&lane=vn" };
  assert.equal(await repository.createMany(["worker"], sourcing), 1);
  assert.equal(await repository.createMany(["worker"], logistics), 1);
  assert.equal(await repository.createMany(["worker"], logistics), 0);
});

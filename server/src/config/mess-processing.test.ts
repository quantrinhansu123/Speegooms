import assert from "node:assert/strict";
import { test } from "node:test";
import type pg from "pg";
import { messageProcessingOptions, updateMessageProcessingSchema } from "@speego/shared";
import { PostgresCrmRepository } from "../adapters/postgres/crm.repository";
import type { CrmRepository, MessageRecord } from "../repositories/crm.repository";
import { CrmService } from "../services/crm.service";

test("processing status accepts exactly L0–L8 and rejects unrelated edits", () => {
  assert.equal(messageProcessingOptions.length, 9);
  for (const [processingStatus] of messageProcessingOptions) {
    assert.deepEqual(updateMessageProcessingSchema.parse({ processingStatus }), { processingStatus });
  }
  for (const input of [{}, { processingStatus: "L9" }, { processingStatus: null }, { processingStatus: "L4", customerName: "Overwrite" }]) {
    assert.equal(updateMessageProcessingSchema.safeParse(input).success, false);
  }
});

test("status updates on both lanes only write processing status, including converted messages", async () => {
  for (const lane of ["vn", "global"] as const) {
    const calls: { sql: string; params: unknown[] }[] = [];
    const stored = { id: "mess-id", status: "CONVERTED", processing_status: "L0", received_at: "2026-11-14", order_lines: null };
    const repo = new PostgresCrmRepository({
      async query(sql: string, params: unknown[] = []) {
        calls.push({ sql, params });
        if (sql.startsWith("update ")) stored.processing_status = params[1] as string;
        return { rows: [stored] };
      },
    } as unknown as pg.Pool);
    for (const [status] of messageProcessingOptions) {
      const saved = await repo.updateMessageProcessing(lane, stored.id, status);
      assert.equal(saved?.processingStatus, status);
      assert.equal(saved?.status, "CONVERTED");
    }
    const writes = calls.filter(({ sql }) => sql.startsWith("update "));
    assert.equal(writes.length, 9);
    assert.ok(writes.every(({ sql }) => sql === `update crm.tin_nhan_${lane === "vn" ? "viet_nam" : "global"} set trang_thai_xu_ly = $2 where id = $1::uuid returning id`));
    await repo.listMessages(lane, { q: "", from: "", to: "", status: "", classification: "", demand: "", customerType: "", market: "" });
    assert.doesNotMatch(calls.at(-1)!.sql, /limit 200/i);
  }
});

test("processing updates preserve creator access checks and missing-message errors", async () => {
  let writes = 0;
  let creator: string | null | "missing" = "owner";
  const repo = {
    messageCreator: async () => creator,
    updateMessageProcessing: async (_lane: string, _id: string, processingStatus: string) => {
      writes++;
      return creator === "missing" ? null : { processingStatus } as MessageRecord;
    },
  } as unknown as CrmRepository;
  const service = new CrmService(repo);
  await assert.rejects(service.updateMessageProcessing("vn", "id", "L1", { id: "other", role: "sale-vn" }), { status: 404 });
  assert.equal(writes, 0);
  assert.equal((await service.updateMessageProcessing("vn", "id", "L8", { id: "owner", role: "sale-vn" })).processingStatus, "L8");
  assert.equal((await service.updateMessageProcessing("global", "id", "L6", { id: "admin", role: "admin" })).processingStatus, "L6");
  creator = "missing";
  await assert.rejects(service.updateMessageProcessing("vn", "id", "L1", { id: "owner", role: "sale-vn" }), { status: 404 });
});

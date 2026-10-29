import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { config } from "dotenv";
import type pg from "pg";
import { createMessageSchema, updatePotentialSchema, updateQuoteSchema } from "@speego/shared";
import { loadEnv } from "../../config/env";
import { PostgresCrmRepository } from "./crm.repository";
import { closePostgresPool, getPostgresPool } from "./pool";

test("CRM queries match the deployed id primary keys without writing data", { skip: process.env.SPEEGO_DB_CHECK !== "1" }, async () => {
  config({ path: new URL("../../../.env", import.meta.url), quiet: true });
  const pool = getPostgresPool(loadEnv());
  const repository = new PostgresCrmRepository(pool);
  // EXPLAIN validates write SQL and its parameters without executing the statement.
  const plan = async (sql: string, params: unknown[] = []) => {
    if (!/^(begin|commit|rollback)$/i.test(sql.trim())) await pool.query(`EXPLAIN ${sql}`, params);
    return { rows: [], rowCount: 0 };
  };
  const planned = new PostgresCrmRepository({
    query: plan,
    connect: async () => ({ query: plan, release() {} }),
  } as unknown as pg.Pool);
  const id = randomUUID();
  const emptyList = { q: "", from: "", to: "" };
  const messageSearch = { ...emptyList, status: "", classification: "", demand: "", customerType: "" };
  const potentialSearch = { ...emptyList, source: "", potential: "", customerKind: "", customerType: "" };
  const quoteSearch = { ...emptyList, quoteStatus: "", contractStatus: "", customerKind: "" };
  const message = createMessageSchema.parse({ customerName: "Schema check", phone: "0900000000", email: "", goods: "", note: "", market: "", saleName: "", painPoint: "" });
  const potential = updatePotentialSchema.parse({ fullName: "Schema check", companyName: "", phone: "0900000000", email: "", productInterest: "", quantityNote: "", address: "", saleNote: "", potential: "POTENTIAL" });
  const quote = updateQuoteSchema.parse({ templateId: id, opsNote: "", quoteStatus: "CHUA_CO_BAO_GIA", contractStatus: "CHUA_TAO", orders: [], notes: { totalLabel: "", weightNote: "", validityNote: "", deposit: "" }, bank: { title: "", accountName: "", accountNumber: "", routingNumber: "" } });
  try {
    for (const lane of ["vn", "global"] as const) {
      assert.ok(Array.isArray(await repository.listMessages(lane, messageSearch)));
      assert.ok(Array.isArray(await repository.listPotentials(lane, potentialSearch)));
      assert.ok(Array.isArray(await repository.listRfqQuotes(lane, quoteSearch, "")));
      await assert.rejects(planned.createMessage(lane, message), /insert message returned no row/);
      assert.equal(await planned.updateMessage(lane, id, message), null);
      assert.equal(await planned.deleteMessage(lane, id), "missing");
      assert.equal(await planned.convertMessage(lane, id), "missing");
      assert.equal(await planned.updatePotential(lane, id, potential), null);
      assert.equal(await planned.deletePotential(lane, id), false);
      assert.equal(await planned.deleteRfqQuote(lane, id), false);
      assert.equal(await planned.requestQuote(lane, id), "missing");
      assert.equal(await planned.reassignRfqQuote(lane, id, id), "missing");
      for (const desk of ["sourcing", "logistics"] as const) {
        assert.ok(Array.isArray(await repository.listQuotes(lane, desk, quoteSearch)));
        assert.ok(Array.isArray(await repository.listQuoteTemplates(desk)));
        assert.equal(await planned.updateQuote(lane, desk, id, quote), "template");
        assert.equal(await planned.updateQuote(lane, desk, id, { ...quote, templateId: null }), "missing");
        assert.equal(await planned.createQuoteTemplate(desk, { name: "Schema check", content: "" }), "duplicate");
        assert.equal(await planned.updateQuoteTemplate(desk, id, { name: "Schema check", content: "" }), "missing");
        assert.equal(await planned.deleteQuoteTemplate(desk, id), "missing");
      }
    }
  } finally {
    await closePostgresPool();
  }
});

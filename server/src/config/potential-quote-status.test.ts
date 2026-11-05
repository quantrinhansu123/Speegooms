import assert from "node:assert/strict";
import test from "node:test";
import type pg from "pg";
import { PostgresCrmRepository } from "../adapters/postgres/crm.repository";

test("potential list includes the latest quote status from each desk", async () => {
  const queries: string[] = [];
  const pool = {
    query: async (sql: string) => {
      queries.push(sql);
      if (sql.includes("select distinct on (potential_id, desk)")) return { rows: [
        { potential_id: "lead-1", desk: "sourcing", status: "DA_CO_BAO_GIA" },
        { potential_id: "lead-1", desk: "logistics", status: "CHUA_CO_BAO_GIA_LAI" },
      ] };
      return { rows: [{ id: "lead-1", lead_code: "TN-1", potential: "POTENTIAL", status: "NEW", created_at: "2026-11-05T00:00:00Z" }] };
    },
  } as unknown as pg.Pool;
  const repository = new PostgresCrmRepository(pool);
  const rows = await repository.listPotentials("vn", { q: "", from: "", to: "", source: "", potential: "", customerKind: "", customerType: "" });
  assert.equal(queries.length, 2);
  assert.equal(rows[0]?.sourcingQuoteStatus, "DA_CO_BAO_GIA");
  assert.equal(rows[0]?.logisticsQuoteStatus, "CHUA_CO_BAO_GIA_LAI");
});

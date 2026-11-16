import assert from "node:assert/strict";
import test from "node:test";
import { paginationSchema, dataLanhListSchema } from "@speego/shared";
import type { CrmRepository } from "../repositories/crm.repository";
import { CrmService } from "../services/crm.service";
import { emptyPage } from "./pagination";

test("lists default to 20 rows and reject invalid page values", () => {
  assert.deepEqual(paginationSchema.parse({}), { page: 1, pageSize: 20 });
  assert.equal(dataLanhListSchema.parse({}).pageSize, 20);
  for (const value of ["0", "-1", "1.5", "NaN", "1000001", ["1", "2"]]) {
    assert.equal(paginationSchema.safeParse({ page: value }).success, false);
    assert.equal(dataLanhListSchema.safeParse({ page: value }).success, false);
  }
  for (const value of ["0", "101", "1.5", "NaN"]) assert.equal(paginationSchema.safeParse({ pageSize: value }).success, false);
  assert.equal(paginationSchema.safeParse({ focusId: "invalid" }).success, false);
});

test("paged Mess keeps creator access restrictions", async () => {
  const inputs: unknown[] = [];
  const repo = { pageMessages: async (_lane: string, search: unknown) => { inputs.push(search); return emptyPage({ page: 1, pageSize: 20 }); } } as unknown as CrmRepository;
  const crm = new CrmService(repo);
  const search = { q: "", from: "", to: "", status: "", classification: "", demand: "", customerType: "", market: "" };
  await crm.pageMessages("global", search, { page: 2, pageSize: 20 }, { id: "sale", role: "sale-global" });
  await crm.pageMessages("global", search, { page: 2, pageSize: 20 }, { id: "lead", role: "sale-global-lead" });
  assert.deepEqual(inputs, [{ ...search, creatorId: "sale" }, search]);
});

test("only Admin may page across both Logistics lanes", async () => {
  let called = false;
  const crm = new CrmService({ pageQuotes: async () => { called = true; return emptyPage({ page: 1, pageSize: 20 }); } } as unknown as CrmRepository);
  const search = { q: "", from: "", to: "", quoteStatus: "", contractStatus: "", customerKind: "" };
  await assert.rejects(crm.pageQuotes("vn", "logistics", search, { page: 1, pageSize: 20 }, "logistics", true), { status: 403 });
  assert.equal(called, false);
  await crm.pageQuotes("vn", "logistics", search, { page: 1, pageSize: 20 }, "admin", true);
  assert.equal(called, true);
});

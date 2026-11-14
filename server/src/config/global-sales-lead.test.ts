import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";
import { roleSchema, canViewQuoteOriginalPrice } from "@speego/shared";
import { can } from "./permissions";
import { CrmController } from "../controllers/crm.controller";
import { DataLanhController } from "../controllers/data-lanh.controller";
import { CrmService } from "../services/crm.service";
import type { CrmRepository } from "../repositories/crm.repository";
import type { PostgresDataLanhRepository } from "../adapters/postgres/data-lanh.repository";

const user = { id: "lead", role: "sale-global-lead" } as const;
const res = { status() { return this; }, json() {} } as unknown as Response;

test("Global lead has Sale permissions without system or other department writes", () => {
  assert.equal(roleSchema.parse(user.role), user.role);
  for (const action of ["message.read", "potential.read", "quote.rfq", "contract.read", "datalanh.read", "message.write", "contract.create"] as const) assert.equal(can(user.role, action), true);
  for (const action of ["user.role.assign", "quote.ops", "contract.accounting", "ledger.read", "payment.create", "datalanh.assign", "datalanh.delete"] as const) assert.equal(can(user.role, action), false);
  assert.equal(canViewQuoteOriginalPrice(user.role), true);
});

test("Global lead lists every creator's Mess; ordinary Sale stays creator-scoped", async () => {
  const searches: unknown[] = [];
  const service = new CrmService({ listMessages: async (_lane: string, search: unknown) => { searches.push(search); return []; } } as unknown as CrmRepository);
  const search = { q: "", from: "", to: "", status: "", classification: "", demand: "", customerType: "", market: "" };
  await service.listMessages("global", search, user);
  await service.listMessages("global", search, { id: "sale", role: "sale-global" });
  assert.deepEqual(searches, [search, { ...search, creatorId: "sale" }]);
});

test("API locks Global lead to Global across list, contract view and imports", async () => {
  const lanes: unknown[] = [];
  const controller = new CrmController({
    listMessages: async (lane: string) => { lanes.push(lane); return []; },
    listContracts: async (lane: string, _sent: boolean, view: string) => { lanes.push([lane, view]); return []; },
    importWorkbook: async (_kind: string, _body: Buffer, allowed: string[]) => { lanes.push(allowed); return {}; },
  } as unknown as CrmService);
  const req = (lane: string) => ({ user, query: { lane }, params: {} } as unknown as Request);
  await controller.listMessages(req("global"), res);
  await assert.rejects(controller.listMessages(req("vn"), res), { status: 403 });
  await controller.listContracts(req("global"), res);
  await controller.importWorkbook({ ...req("vn"), params: { kind: "messages" }, body: Buffer.from("workbook") } as unknown as Request, res);
  assert.deepEqual(lanes, ["global", ["global", "sale"], ["global"]]);
});

test("Global lead sees all shared customer data; ordinary Sale remains assigned-scoped", async () => {
  const scopes: unknown[] = [];
  const controller = new DataLanhController({ list: async (scope: unknown) => { scopes.push(scope); return []; } } as unknown as PostgresDataLanhRepository);
  await controller.list({ user } as Request, res);
  await controller.list({ user: { id: "sale", role: "sale-global" } } as Request, res);
  assert.deepEqual(scopes, [null, "sale"]);
});

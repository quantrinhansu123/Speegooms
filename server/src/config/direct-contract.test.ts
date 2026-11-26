import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";
import express from "express";
import type pg from "pg";
import { createDirectContractSchema, type CreateDirectContractInput, type CrmLane, type PublicUser, type Role } from "@speego/shared";
import { PostgresCrmRepository } from "../adapters/postgres/crm.repository";
import type { AppContainer } from "../container";
import { CrmController } from "../controllers/crm.controller";
import { crmActor } from "../lib/crm-actor";
import { errorHandler } from "../middlewares/error-handler";
import type { ContractRecord, CrmRepository } from "../repositories/crm.repository";
import { crmRoutes } from "../routes/crm.routes";
import { CrmService } from "../services/crm.service";

const draft = {
  customerName: "Khách trực tiếp", saleName: "Sale", shipTo: "", product: "Ghế", quantity: 2,
  currency: "USD", productValue: 100.15, shippingCost: 20.1, paidAmount: 30, signedOn: "",
};
const actor = (role: Role) => ({ id: "sale-id", role, name: "Sale hiện tại" } as PublicUser);

test("direct contract derives its total, validates payments and needs no quote", () => {
  const parsed = createDirectContractSchema.parse({ ...draft, totalValue: 999, quoteId: "forged-quote" });
  assert.equal(parsed.totalValue, 120.25);
  assert.equal("quoteId" in parsed, false);
  assert.deepEqual(parsed.vndRates, {});
  assert.equal(parsed.industry, null);
  for (const patch of [
    { customerName: "   " }, { productValue: -1 }, { shippingCost: -1 }, { quantity: -1 },
    { productValue: 1_000_000_000, shippingCost: 1 },
    { currency: "invalid" }, { vndRates: { USD: 0 } }, { productValue: 0.005 }, { paidAmount: 0.005 },
  ]) assert.equal(createDirectContractSchema.safeParse({ ...draft, ...patch }).success, false, JSON.stringify(patch));
  assert.equal(createDirectContractSchema.parse({ ...draft, productValue: 0.1, shippingCost: 0.2, paidAmount: 0.3 }).totalValue, 0.3);
  // Khách được trả dư: thanh toán lớn hơn tổng giá trị vẫn hợp lệ.
  assert.equal(createDirectContractSchema.safeParse({ ...draft, paidAmount: 121 }).success, true);
});

test("POST /contracts creates without a quote, enforces permissions and the Sale lane", async () => {
  let currentRole: Role | null = "sale-vn";
  const saved: { lane: CrmLane; input: CreateDirectContractInput }[] = [];
  const notified: string[] = [];
  const service = new CrmService({
    findQuote: async () => { throw new Error("Direct creation must not read quotes"); },
    createDirectContract: async (lane: CrmLane, input: CreateDirectContractInput) => {
      saved.push({ lane, input });
      return { ...input, lane, id: "contract", code: "HD-DIRECT", quoteId: null, quoteCode: null } as unknown as ContractRecord;
    },
  } as unknown as CrmRepository, {
    notifyContractCreated: async (_actor: PublicUser, lane: CrmLane) => { notified.push(lane); },
  } as never);
  const app = express();
  app.use(express.json());
  app.use("/contracts-test", crmRoutes({
    crmController: new CrmController(service),
    authenticate: (req, res, next) => {
      if (!currentRole) { res.status(401).json({ error: { message: "Chưa đăng nhập" } }); return; }
      req.user = actor(currentRole);
      next();
    },
  } as AppContainer));
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const post = (lane: string, body = draft) => fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/contracts-test/contracts?lane=${lane}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    for (const [role, lane] of [["sale-vn", "vn"], ["sale-global", "global"], ["sale-global-lead", "global"], ["admin", "vn"], ["admin", "global"]] as const) {
      currentRole = role;
      const response = await post(lane);
      assert.equal(response.status, 201);
      const { contract } = await response.json();
      assert.equal(contract.quoteId, null);
      assert.equal(contract.totalValue, 120.25);
      assert.equal(saved.at(-1)?.lane, lane);
      assert.equal(saved.at(-1)?.input.saleName, "Sale hiện tại");
    }
    assert.equal(notified.length, 5);
    for (const role of ["ban-gd", "van-hanh", "sourcing", "logistics", "ke-toan", "marketing", "sale-intern"] as const) {
      currentRole = role;
      assert.equal((await post("vn")).status, 403);
    }
    currentRole = null;
    assert.equal((await post("vn")).status, 401);
    currentRole = "sale-vn";
    assert.equal((await post("global")).status, 403);
    assert.equal((await post("vn", { ...draft, paidAmount: 121 })).status, 201);
    assert.equal((await post("vn", { ...draft, customerName: "" })).status, 422);
    currentRole = "sale-global";
    assert.equal((await post("vn")).status, 403);
    assert.equal(saved.length, 6);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

function repositoryFixture(lane: CrmLane, input: CreateDirectContractInput, failSnapshot = false) {
  const calls: { sql: string; values: unknown[] }[] = [];
  const client = {
    query: async (sql: string, values: unknown[] = []) => {
      calls.push({ sql, values });
      if (sql.includes("insert into crm.hop_dong (")) return { rows: [{ id: "direct-id" }] };
      if (failSnapshot && sql.includes("update crm.hop_dong set ban_gui_van_hanh")) throw new Error("snapshot failed");
      if (sql.includes("select h.id")) return { rows: [{
        id: "direct-id", code: "HD-DIRECT", lane, quote_id: null, quote_code: null, quote_desk: null,
        customer_name: input.customerName, currency: input.currency, product_value: input.productValue,
        shipping_cost: input.shippingCost, total_value: input.totalValue, paid_amount: input.paidAmount,
        balance: input.totalValue - input.paidAmount, created_at: new Date(), updated_at: new Date(),
        amounts_body: { product: [{ currency: input.currency, amount: input.productValue }], shipping: [{ currency: input.currency, amount: input.shippingCost }], vndRates: input.vndRates },
      }] };
      if (sql.includes("from crm.bao_gia")) throw new Error("Direct contract must not query a quote");
      return { rows: [], rowCount: 1 };
    },
    release: () => { calls.push({ sql: "release", values: [] }); },
  };
  return { calls, repo: new PostgresCrmRepository({ connect: async () => client, query: client.query } as unknown as pg.Pool) };
}

test("direct contracts persist amounts, initial payment and ops snapshot atomically on both lanes", async () => {
  for (const lane of ["vn", "global"] as const) for (const paidAmount of [0, 30]) {
    const input = createDirectContractSchema.parse({ ...draft, paidAmount });
    const { repo, calls } = repositoryFixture(lane, input);
    const contract = await crmActor.run(actor(lane === "vn" ? "sale-vn" : "sale-global"), () => repo.createDirectContract(lane, input));
    assert.equal(contract.quoteId, null);
    assert.equal(contract.quoteCode, null);
    assert.equal(contract.totalValue, 120.25);
    assert.equal(contract.balance, 120.25 - paidAmount);
    const insert = calls.find(call => call.sql.includes("insert into crm.hop_dong ("))!;
    assert.equal(insert.values[0], lane);
    assert.equal(insert.values[8], 120.25);
    assert.equal(insert.values[9], paidAmount);
    assert.equal(insert.sql.includes("ma_bao_gia"), false);
    assert.deepEqual(JSON.parse(String(insert.values[13])).shipping, [{ currency: "USD", amount: 20.1 }]);
    assert.equal(calls.filter(call => call.sql.includes("insert into crm.hop_dong_dong_thanh_toan")).length, paidAmount ? 1 : 0);
    assert.ok(calls.some(call => call.sql.includes("ban_gui_van_hanh = jsonb_build_object")));
    assert.ok(calls.some(call => call.sql.includes("app.crm_actor_id")));
    assert.equal(calls.at(-2)?.sql, "commit");
    assert.equal(calls.at(-1)?.sql, "release");
  }
});

test("direct creation rolls back the contract and payment if saving the snapshot fails", async () => {
  const input = createDirectContractSchema.parse(draft);
  const { repo, calls } = repositoryFixture("vn", input, true);
  await assert.rejects(repo.createDirectContract("vn", input));
  assert.ok(calls.some(call => call.sql === "rollback"));
  assert.equal(calls.some(call => call.sql === "commit"), false);
  assert.equal(calls.at(-1)?.sql, "release");
});

test("updateDirectContract rewrites commercial columns, only for quote-less contracts, keeps payments", async () => {
  const parsed = createDirectContractSchema.parse({ ...draft, customerName: "Khách sửa" });
  const { calls, repo } = repositoryFixture("vn", parsed);
  const result = await crmActor.run(actor("admin"), () => repo.updateDirectContract("vn", "direct-id", parsed));
  assert.notEqual(result, "missing");
  const update = calls.find((call) => call.sql.includes("ten_khach_hang = $3"));
  assert.ok(update, "update statement issued");
  assert.match(update.sql, /ma_bao_gia is null/);
  assert.equal(update.values[2], "Khách sửa");
  assert.equal(update.values[8], 120.25);
  assert.equal(calls.some((call) => /^s*(insert into|delete from) crm.hop_dong_dong_thanh_toan/i.test(call.sql)), false);
});

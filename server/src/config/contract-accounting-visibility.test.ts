import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";
import type pg from "pg";
import { accountingContractSchema } from "@speego/shared";
import { PostgresCrmRepository } from "../adapters/postgres/crm.repository";
import { CrmController } from "../controllers/crm.controller";
import type { CrmService } from "../services/crm.service";
import { contractSearch } from "../search/crm-list-search";

const search = { q: "", from: "", to: "", opsStatus: "", accountingStatus: "", customerKind: "" };

test("accounting lists all contracts on both lanes, including requests from older clients using sent=1", async () => {
  for (const lane of ["vn", "global"] as const) {
    for (const sent of [undefined, "1"]) {
      for (const view of [undefined, "accounting"]) {
        let called = false;
        const result = { rows: [{ id: "old-contract" }], pagination: { page: 2, pages: 3, total: 45, pageSize: 20, summary: {} } };
        const controller = new CrmController({
          pageContracts: async (actualLane, sentOnly, actualView, actualSearch, page) => {
            called = true;
            assert.equal(actualLane, lane);
            assert.equal(sentOnly, false);
            assert.equal(actualView, "accounting");
            assert.deepEqual(actualSearch, search);
            assert.equal(page.page, 2);
            return result;
          },
        } as CrmService);
        let body: unknown;
        const response = { status: () => response, json: (value: unknown) => { body = value; } } as unknown as Response;
        await controller.listContracts({ user: { role: "ke-toan" }, query: { lane, sent, view, page: "2" } } as unknown as Request, response);
        assert.equal(called, true);
        assert.deepEqual(body, { contracts: result.rows, pagination: result.pagination });
      }
    }
  }
});

test("contract view restrictions still prevent Sale from requesting the accounting view", async () => {
  const controller = new CrmController({} as CrmService);
  for (const role of ["sale-vn", "sale-global", "sourcing"]) {
    await assert.rejects(controller.listContracts({ user: { role }, query: { lane: "vn", view: "accounting" } } as unknown as Request, {} as Response), /Không xem hợp đồng ở bên này/);
  }
});

function rawContract(lane: "vn" | "global", snapshot: Record<string, unknown> | null = null) {
  return {
    id: "old-contract", code: "HD-OLD", lane, quote_id: null, customer_name: "Khách cũ", sale_name: "Sale",
    product: "Hàng cũ", ship_to: "US", quantity: 12, currency: "VND", shipping_currency: "VND",
    product_value: 1000, shipping_cost: 200, total_value: 1200, paid_amount: 300, balance: 900,
    signed_on: "2026-10-01", tracking: "TRACK-OLD", note_1: "Ghi chú 1", note_2: "Ghi chú 2",
    china_warehouse_on: "2026-10-02", container_on: "2026-10-03", arrival_on: "2026-10-04", delivery_on: "2026-10-05",
    payments: [{ amount: 300, currency: "VND", paidOn: "2026-10-01", images: ["https://example.com/bill.png"] }],
    confirmations: [{ amount: 300, currency: "VND", images: ["https://example.com/confirmation.png"] }],
    confirmed_amount: 300, accounting_status: "DA_HOAN_THANH_COC", ops_status: "Đang vận chuyển",
    sent_to_accounting_at: snapshot ? new Date("2026-10-02") : null, sent_accounting_body: snapshot,
    created_at: new Date("2026-10-01"), updated_at: new Date("2026-10-02"),
  };
}

test("old contracts without an accounting snapshot retain customer, commercial, shipping and payment details", async () => {
  for (const lane of ["vn", "global"] as const) {
    const raw = rawContract(lane);
    const repo = new PostgresCrmRepository({ query: async () => ({ rows: [{ ...raw, __present: true, __total: 1, __page: 1, __summary: {} }] }) } as unknown as pg.Pool);
    const [sale] = await repo.listContracts(lane, false, "sale", search);
    const [accounting] = await repo.listContracts(lane, false, "accounting", search);
    assert.deepEqual(accounting, sale);
    const page = await repo.pageContracts(lane, false, "accounting", search, { page: 1, pageSize: 20 });
    assert.deepEqual(page.rows, [sale]);
    assert.equal(page.pagination.total, 1);
  }
});

test("sent contracts keep the commercial and shipping snapshot together with current payments and confirmations", async () => {
  for (const lane of ["vn", "global"] as const) {
    const snapshot = { customerName: "Tên trước khi sửa", saleName: "Sale đã gửi", shipTo: "UK", product: "Hàng đã gửi", quantity: 8,
      currency: "VND", productValue: 900, shippingCost: 100, totalValue: 1000, signedOn: "2026-09-30", tracking: "TRACK-SENT", note1: "Đã gửi", note2: "Đã gửi 2" };
    const raw = rawContract(lane, snapshot);
    const repo = new PostgresCrmRepository({ query: async () => ({ rows: [raw] }) } as unknown as pg.Pool);
    const [contract] = await repo.listContracts(lane, false, "accounting", search);
    assert.equal(contract.customerName, raw.customer_name);
    assert.equal(contract.product, snapshot.product);
    assert.equal(contract.saleName, snapshot.saleName);
    assert.equal(contract.shipTo, snapshot.shipTo);
    assert.equal(contract.quantity, snapshot.quantity);
    assert.equal(contract.signedOn, snapshot.signedOn);
    assert.equal(contract.tracking, snapshot.tracking);
    assert.equal(contract.note1, snapshot.note1);
    assert.equal(contract.paidAmount, 300);
    assert.equal(contract.totalValue, 1200);
    assert.equal(contract.balance, 900);
    assert.equal(contract.confirmedAmount, 300);
    assert.equal(contract.accountingStatus, "DA_HOAN_THANH_COC");
    assert.deepEqual(contract.images, ["https://example.com/confirmation.png"]);
  }
});

test("accounting date filters fall back to the contract signing date without a sent snapshot", () => {
  const compiled = contractSearch("accounting", { ...search, from: "2026-10-01", to: "2026-10-31" }).build();
  assert.match(compiled.sql, /coalesce\(nullif\(ban_gui_ke_toan->>'signedOn', ''\)::date, h.ngay_ky\)/);
  assert.deepEqual(compiled.values, ["2026-10-01", "2026-10-31"]);
});

test("viewing unsent contracts does not enable accounting confirmation before handoff", async () => {
  for (const lane of ["vn", "global"] as const) {
    const statements: string[] = [];
    const repo = new PostgresCrmRepository({ query: async (sql: string) => {
      statements.push(sql);
      return { rows: [rawContract(lane)] };
    } } as unknown as pg.Pool);
    const input = accountingContractSchema.parse({ accountingStatus: "DA_HOAN_THANH_COC", confirmations: [{ amount: 300, currency: "VND", note: "", images: [] }] });
    assert.equal(await repo.updateAccountingContract(lane, "old-contract", input), "pending");
    assert.equal(statements.every(sql => sql.trimStart().startsWith("select")), true);
  }
});

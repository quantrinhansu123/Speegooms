import assert from "node:assert/strict";
import test from "node:test";
import type pg from "pg";
import type { CrmLane, PublicUser, QuoteDesk } from "@speego/shared";
import { PostgresCrmRepository } from "../adapters/postgres/crm.repository";
import type { CrmRepository, QuoteRecord } from "../repositories/crm.repository";
import type { NotificationService } from "../services/notification.service";
import { CrmService } from "../services/crm.service";

test("Sale handoffs record request time after validation and before notifying either desk", async () => {
  for (const lane of ["vn", "global"] as const) {
    for (const desk of ["sourcing", "logistics"] as const) {
      const events: string[] = [];
      const current = {
        id: "quote", code: "BG", customerKind: desk === "sourcing" ? "SOURCING" : "LOGISTICS",
        orders: [{ lines: [{ productName: "Goods", quantity: 1, packages: [], weightKg: 2 }] }],
        createdAt: "2026-11-10T00:00:00.000Z",
      } as unknown as QuoteRecord;
      const requested = { ...current, requestedAt: "2026-11-13T00:00:00.000Z" };
      const service = new CrmService({
        findQuote: async () => current,
        recordQuoteRequest: async (actualLane: CrmLane, actualDesk: QuoteDesk, id: string) => {
          assert.deepEqual([actualLane, actualDesk, id], [lane, desk, "quote"]);
          events.push("record");
          return requested;
        },
      } as unknown as CrmRepository, {
        notifyQuoteRequested: async () => { events.push("notify"); },
      } as unknown as NotificationService);
      const actor = { id: "sale", role: lane === "vn" ? "sale-vn" : "sale-global" } as PublicUser;
      const handoff = () => desk === "sourcing"
        ? service.handoffSourcingOrder(lane, "quote", actor)
        : service.handoffLogisticsOrder(lane, "quote", actor);
      assert.equal(await handoff(), requested);
      assert.deepEqual(events, ["record", "notify"]);
      assert.equal(requested.createdAt, "2026-11-10T00:00:00.000Z");
      current.orders = [];
      await assert.rejects(handoff(), { status: 400 });
      assert.deepEqual(events, ["record", "notify"], "invalid handoffs never change request time");
    }
  }
});

test("Logistics merges pure and Sourcing requests by request time while retaining their creation dates", async () => {
  for (const lane of ["vn", "global"] as const) {
    const repository = new PostgresCrmRepository({
      query: async (query: string) => ({ rowCount: 1, rows: [{
        id: query.includes("from crm.bao_gia_logistics_") ? "pure" : "shared",
        customer_kind: query.includes("from crm.bao_gia_logistics_") ? "LOGISTICS" : "SOURCING",
        quote_workflow: "COMBINED", created_at: "2026-11-10T00:00:00Z",
        requested_at: "2026-11-12T00:00:00Z", logistics_requested_at: "2026-11-13T00:00:00Z",
      }] }),
    } as unknown as pg.Pool);
    const quotes = await repository.listQuotes(lane, "logistics", {
      q: "", from: "", to: "", quoteStatus: "", contractStatus: "", customerKind: "",
    });
    assert.deepEqual(quotes.map(row => row.id), ["shared", "pure"]);
    assert.deepEqual(quotes.map(row => row.requestedAt), ["2026-11-13T00:00:00.000Z", "2026-11-12T00:00:00.000Z"]);
    assert.ok(quotes.every(row => row.createdAt === "2026-11-10T00:00:00.000Z"));
  }
});

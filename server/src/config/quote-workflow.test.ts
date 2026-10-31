import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canViewQuote, convertMessageSchema, customerKindSchema, isCombinedSourcing,
  quoteAccessKind, quoteNotifyRoles,
} from "@speego/shared";
import type pg from "pg";
import { PostgresCrmRepository } from "../adapters/postgres/crm.repository";
import { CrmService } from "../services/crm.service";
import type { CrmRepository, QuoteRecord } from "../repositories/crm.repository";
import type { NotificationService } from "../services/notification.service";
import { defaultQuoteBank, updateQuoteSchema, type PublicUser, type QuoteDesk } from "@speego/shared";

test("conversion reason is optional while customer requirements remain mandatory", () => {
  for (const reason of [undefined, "", "   ", "Khách cần mua hàng"]) {
    const result = convertMessageSchema.parse({ requirements: "Đơn hàng", reason });
    assert.equal(result.reason, reason?.trim() ?? "");
  }
  assert.equal(convertMessageSchema.safeParse({ requirements: " " }).success, false);
  assert.equal(customerKindSchema.safeParse("SOURCING_LOGISTICS").success, false);
});

test("combined sourcing routes viewing and notifications to the correct desk", () => {
  const combined = { customerKind: "SOURCING", quoteWorkflow: "COMBINED" as const };
  const legacy = { ...combined, quoteWorkflow: "LEGACY" as const };
  assert.equal(isCombinedSourcing(combined), true);
  assert.equal(isCombinedSourcing(legacy), false);
  assert.equal(isCombinedSourcing({ ...combined, customerKind: "LOGISTICS" }), false);
  assert.equal(canViewQuote("logistics", "sourcing", quoteAccessKind(combined)), false);
  assert.equal(canViewQuote("logistics", "logistics", quoteAccessKind(combined)), true);
  assert.equal(canViewQuote("logistics", "sourcing", quoteAccessKind(legacy)), true);
  assert.equal(quoteNotifyRoles("sourcing", quoteAccessKind(combined)).includes("logistics"), false);
  assert.equal(quoteNotifyRoles("logistics", quoteAccessKind(combined)).includes("logistics"), true);
});

test("both lanes create a shared sheet only for the persisted combined workflow", async () => {
  for (const lane of ["vn", "global"] as const) {
    for (const workflow of ["LEGACY", "COMBINED"] as const) {
      const statements: string[] = [];
      const repository = new PostgresCrmRepository({
        query: async (sql: string) => {
          statements.push(sql);
          if (sql.includes("select nhom_khach")) return { rowCount: 1, rows: [{ customer_kind: "SOURCING", quote_workflow: workflow }] };
          if (sql.includes("select q.id")) return { rowCount: 1, rows: [{ customer_kind: "SOURCING", quote_workflow: workflow, created_at: new Date() }] };
          return { rowCount: 1, rows: [] };
        },
      } as unknown as pg.Pool);
      await repository.requestQuote(lane, "00000000-0000-0000-0000-000000000001");
      assert.equal(statements.some((sql) => sql.includes("set bao_gia_logistics")), workflow === "COMBINED");
      assert.equal(statements.some((sql) => sql.includes("set luong_bao_gia")), false);
    }
  }
});

test("Logistics SQL scope separates legacy sourcing from combined sourcing", async () => {
  const statements: { sql: string; values: unknown[] }[] = [];
  const repository = new PostgresCrmRepository({
    query: async (sql: string, values: unknown[]) => {
      statements.push({ sql, values });
      return { rowCount: 0, rows: [] };
    },
  } as unknown as pg.Pool);
  const search = { q: "", from: "", to: "", quoteStatus: "", contractStatus: "", customerKind: "SOURCING" };
  await repository.listQuotes("vn", "sourcing", search, ["SOURCING"]);
  assert.match(statements[0].sql, /case when.*luong_bao_gia = 'COMBINED'/);
  assert.match(statements[0].sql, /any\(\$2::text\[\]\)/);
  assert.deepEqual(statements[0].values, ["SOURCING", ["SOURCING"]]);
  statements.length = 0;
  await repository.listQuotes("global", "logistics", search, ["LOGISTICS", "SOURCING_LOGISTICS"]);
  assert.ok(statements.some(({ sql }) => sql.includes("l.luong_bao_gia = 'COMBINED'")));
});

test("quote projection preserves both workflow and Sale requirement images after merging", async () => {
  for (const lane of ["vn", "global"] as const) {
    const repository = new PostgresCrmRepository({
      query: async (sql: string) => {
        assert.match(sql, /l\.luong_bao_gia as quote_workflow/);
        assert.match(sql, /l\.anh_yeu_cau as requirement_images/);
        assert.match(sql, /left join crm\.tin_nhan_(viet_nam|global) msg/);
        return { rowCount: 1, rows: [{
          id: "quote", customer_kind: "SOURCING", quote_workflow: "COMBINED",
          customer_type: "ENTERPRISE", brand: "SOURCING", potential: "POTENTIAL",
          requirements: "Giữ yêu cầu khách", requirement_images: ["https://example.com/requirement.png"],
          sale_note: "Giữ ghi chú Sale", mess_code: "MESS-1", link_mess: "https://example.com/message",
          created_at: new Date(),
        }] };
      },
    } as unknown as pg.Pool);
    const [quote] = await repository.listQuotes(lane, "sourcing", {
      q: "", from: "", to: "", quoteStatus: "", contractStatus: "", customerKind: "SOURCING",
    });
    assert.equal(isCombinedSourcing(quote), true);
    assert.equal(quote.customerType, "ENTERPRISE");
    assert.equal(quote.requirements, "Giữ yêu cầu khách");
    assert.deepEqual(quote.requirementImages, ["https://example.com/requirement.png"]);
    assert.equal(quote.saleNote, "Giữ ghi chú Sale");
    assert.equal(quote.messCode, "MESS-1");
    assert.equal(quote.linkMess, "https://example.com/message");
  }
});

test("a new combined order notifies both desks once", async () => {
  const desks: QuoteDesk[] = [];
  let created = true;
  const quote = { id: "quote", code: "BGS", customerKind: "SOURCING", quoteWorkflow: "COMBINED" } as QuoteRecord;
  const service = new CrmService({
    requestQuote: async () => ({ quote, created, desk: "sourcing" }),
  } as unknown as CrmRepository, {
    notifyQuoteRequested: async (_actor: PublicUser, _lane: string, desk: QuoteDesk) => { desks.push(desk); },
  } as unknown as NotificationService);
  await service.requestQuote("vn", "customer", { role: "sale-vn" } as PublicUser);
  assert.deepEqual(desks, ["sourcing", "logistics"]);
  created = false;
  await service.requestQuote("vn", "customer", { role: "sale-vn" } as PublicUser);
  assert.equal(desks.length, 2);
});

test("Sale content updates preserve Logistics packaging for the new workflow", async () => {
  const input = updateQuoteSchema.parse({
    templateId: null, opsNote: "", quoteStatus: "CHUA_CO_BAO_GIA", contractStatus: "CHUA_TAO",
    orders: [{ id: "00000000-0000-0000-0000-000000000001", name: "Order", selected: true, currency: "VND", rate: null,
      lines: [{ stt: "1", quantity: 1, pricePerSet: null, lineTotal: null, weightKg: null, unit: "set", spec: "", note: "" }] }],
    notes: { totalLabel: "", weightNote: "", validityNote: "", deposit: [] }, bank: defaultQuoteBank,
  });
  const packages = [{ count: 2, lengthCm: 20, widthCm: 30, heightCm: 40, actualKg: 5 }];
  const current = { ...input, id: "quote", customerKind: "SOURCING", quoteWorkflow: "COMBINED",
    orders: input.orders.map((order) => ({ ...order, lines: order.lines.map((line) => ({ ...line, packages, cbm: 0.048 })) })),
  } as QuoteRecord;
  const service = new CrmService({
    findQuote: async () => current,
    updateQuote: async (_lane: string, _desk: string, _id: string, patch: typeof input) => {
      assert.deepEqual(patch.orders[0].lines[0].packages, packages);
      assert.equal(patch.orders[0].lines[0].cbm, 0.048);
      return current;
    },
  } as unknown as CrmRepository);
  await service.updateQuote("vn", "logistics", "quote", input, { contentOnly: true, role: "sale-vn" });
});
